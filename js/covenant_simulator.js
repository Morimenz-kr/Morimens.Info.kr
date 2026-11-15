(function() {
    const STORAGE_KEY = 'morimens_covenant_simulator_state_v1';
    const PRESET_STORAGE_KEY = 'morimens_covenant_simulator_presets_v1';
    const ROMANS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    const TARGET_PART_ORDER = [3, 0, 4, 1, 5, 2];
    const OPTIONS = [
        { id: 'critRate', name: '크리티컬 확률', step: 0.2, unit: '%' },
        { id: 'critDamage', name: '크리티컬 피해', step: 0.3, unit: '%' },
        { id: 'domainMastery', name: '영역 숙련', step: 0.5, unit: '' },
        { id: 'damageAmp', name: '피해 증폭', step: 0.2, unit: '%' },
        { id: 'madnessRegen', name: '광기 충전', step: 0.1, unit: '' },
        { id: 'silverCharge', name: '은열쇠 충전', step: 0.3, unit: '' },
        { id: 'blackSealDrop', name: '검은 인장 획득률', step: 0.15, unit: '%' },
        { id: 'deathResist', name: '죽음 저항', step: 0.7, unit: '%' }
    ];
    const MAIN_OPTIONS = [
        ['critRate', 'critDamage', 'madnessRegen', 'silverCharge'],
        ['critRate', 'critDamage', 'domainMastery', 'blackSealDrop'],
        ['critRate', 'critDamage', 'damageAmp', 'deathResist'],
        ['domainMastery', 'madnessRegen', 'silverCharge', 'blackSealDrop'],
        ['damageAmp', 'madnessRegen', 'silverCharge', 'deathResist'],
        ['domainMastery', 'damageAmp', 'blackSealDrop', 'deathResist']
    ];
    const MAX_MAIN_LEVEL = 12;
    const optionById = Object.fromEntries(OPTIONS.map(option => [option.id, option]));
    const els = {};
    const state = {
        contracts: [],
        selectedContract: null,
        editorParts: [], editorBound:false, targetBound:false,
        selectedPart: 0,
        mode: 'editor',
        manualPreview: null,
        manualResult: null,
        targetResult: null,
        resultStatuses: {manual:{message:'',type:''},target:{message:'',type:''}},
        totals: createEmptyTotals(),
        presets: [],
        pendingContractName: '',
        hasUnsavedPresetChanges: false,
        isSimulating: false,
        targetParts: [0, 1, 2, 3, 4, 5],
        targetEditorPart: 0,
        targetEditorView: 'goals',
        parts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index)),
        targetSimParts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index))
    };

    document.addEventListener('DOMContentLoaded', init);

    let renderSharedCovenantEditor, renderSimulatorCovenantParts, sharedModel, editorDefinition, editorParts, sharedEditor, pickPosition=null, pickView=null;
    let sharedOwner, targetModel, activeTargetRun=null, pickerMode='editor', editorView=null;
    const partsFor=mode=>mode==='editor'?state.editorParts:mode==='target'?state.targetSimParts:state.parts;
    const boundKey=mode=>mode==='editor'?'editorBound':mode==='target'?'targetBound':'contractBound';
    const activeBound=()=>!!state[boundKey(state.mode)];
    function openSetPicker(mode,position=null){pickerMode=mode;pickPosition=position;renderContract();document.getElementById('covenant-set-dialog').showModal();}
    async function init() {
        const panel=document.querySelector('.simulator-panel'),status=document.getElementById('storage-status');
        const controls=[...panel.querySelectorAll('button,input,select')].map(control=>({control,disabled:control.disabled}));
        panel.setAttribute('aria-busy','true');status.textContent='시뮬레이터를 불러오는 중입니다.';
        for(const {control}of controls)control.disabled=true;
        try{
            const moduleRevision='?v='+encodeURIComponent(CONFIG.VERSION+'-'+CONFIG.ASSET_REVISION);
            ({renderCovenantEditor:renderSharedCovenantEditor}=await import('./covenant-editor.mjs'+moduleRevision));
            ({renderCovenantParts:renderSimulatorCovenantParts}=await import('./covenant-parts.mjs'+moduleRevision));
            sharedModel=await import('./covenant-simulator-model.mjs'+moduleRevision);
            targetModel=await import('./covenant-target.mjs'+moduleRevision);
            cacheElements();bindEvents();await loadContracts();
            for(const {control,disabled}of controls)control.disabled=disabled;
            status.textContent='';renderAll();saveCurrentState();
            document.getElementById('covenant-help').disabled=false;
            document.dispatchEvent(new Event('covenant-ready'));
        }catch(error){
            console.warn('비밀계약 시뮬레이터 로딩에 실패했습니다.',error);
            status.textContent='시뮬레이터를 불러오지 못했습니다. 연결을 확인한 뒤 새로고침하세요.';
        }finally{panel.setAttribute('aria-busy','false');}
    }

    function cacheElements() {
        [
            'contract-grid', 'selected-contract-name', 'editor-panel', 'manual-panel', 'target-panel',
            'manual-part-title', 'manual-before-completion', 'manual-after-completion',
            'manual-cost', 'manual-status', 'manual-result', 'manual-reroll-btn', 'manual-apply-btn',
            'target-scope-buttons', 'target-lock-cost', 'target-current-parts', 'target-parts',
            'run-target-btn', 'result-summary', 'result-status',
            'preset-name-input', 'preset-select', 'save-preset-btn', 'load-preset-btn', 'delete-preset-btn',
            'contract-change-modal', 'confirm-contract-change-btn', 'cancel-contract-change-btn',
            'reset-sim-btn'
        ].forEach(id => {
            els[toCamel(id)] = document.getElementById(id);
        });
        els.contractChangeMessage = document.querySelector('.contract-change-message');
        els.modeTabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
    }

    function bindEvents() {
        document.getElementById('close-covenant-set-picker').onclick=()=>document.getElementById('covenant-set-dialog').close();
        els.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if(state.mode==='target'&&tab.dataset.modeTab!=='target')cancelTargetSimulation();
                state.mode = tab.dataset.modeTab;
                renderParts();renderMode();
                saveCurrentState();
            });
            tab.addEventListener('keydown',event=>{
                if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
                event.preventDefault();const index=els.modeTabs.indexOf(tab),count=els.modeTabs.length;
                const next=event.key==='Home'?0:event.key==='End'?count-1:(index+(event.key==='ArrowRight'?1:-1)+count)%count;
                els.modeTabs[next].focus();els.modeTabs[next].click();
            });
        });
        document.querySelectorAll('input[name="manual-lock-cost"]').forEach(input => {
            input.addEventListener('change', () => {
                renderManual();
                markSettingsChanged();
            });
        });
        els.targetLockCost.addEventListener('change', markTargetSettingsChanged);
        document.querySelectorAll('[data-resource-switch]').forEach(button=>button.onclick=()=>{
            const value=button.getAttribute('aria-checked')==='true'?'fragment':'quill';
            const input=button.dataset.resourceSwitch==='manual'?document.querySelector(`input[name="manual-lock-cost"][value="${value}"]`):els.targetLockCost;
            if(input.type==='radio')input.checked=true;else input.value=value;
            input.dispatchEvent(new Event('change',{bubbles:true}));syncResourceSwitches();
        });
        document.querySelectorAll('[data-simulator-bound]').forEach(input=>input.onchange=()=>{
            const mode=input.dataset.simulatorBound;
            state[boundKey(mode)]=input.checked;
            if(mode==='target'){cancelTargetSimulation();renderTargetScopeButtons();}
            else renderManual();
            renderBoundControls();renderResultSummary();saveCurrentState();
        });
        document.querySelectorAll('[data-target-editor-view]').forEach(tab=>{
            tab.onclick=()=>{state.targetEditorView=tab.dataset.targetEditorView;renderTargetEditorNavigation();saveCurrentState();};
            tab.onkeydown=event=>{
                if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
                event.preventDefault();const view=event.key==='Home'?'current':event.key==='End'?'goals':state.targetEditorView==='current'?'goals':'current';const next=document.querySelector(`[data-target-editor-view="${view}"]`);next.click();next.focus();
            };
        });
        document.getElementById('edit-transcription-part').onclick=()=>{renderSharedEditor('manual');sharedEditor?.editPart(state.selectedPart+1);document.getElementById('manual-setting-dialog').showModal();};
        document.getElementById('close-manual-settings').onclick=()=>document.getElementById('manual-setting-dialog').close();
        document.getElementById('manual-setting-dialog').addEventListener('close',placeStorageStatus);
        els.manualRerollBtn.addEventListener('click', manualReroll);
        els.manualApplyBtn.addEventListener('click', applyManualPreview);
        els.runTargetBtn.addEventListener('click', runTargetSimulation);
        document.getElementById('stop-target-btn').addEventListener('click',()=>cancelTargetSimulation('목표 시뮬레이션을 중단했습니다.'));
        document.getElementById('target-change-covenant').onclick=()=>openSetPicker('target');
        document.querySelectorAll('[data-import-preset]').forEach(button=>button.onclick=()=>importEquipmentPreset(button.dataset.importPreset));
        els.savePresetBtn.addEventListener('click', savePreset);
        els.loadPresetBtn.addEventListener('click', loadSelectedPreset);
        els.deletePresetBtn.addEventListener('click', deleteSelectedPreset);
        els.confirmContractChangeBtn.addEventListener('click', confirmContractChange);
        els.cancelContractChangeBtn.addEventListener('click', closeContractChangeModal);
        els.contractChangeModal.addEventListener('click', event => {
            if (event.target === els.contractChangeModal) closeContractChangeModal();
        });
        els.resetSimBtn.addEventListener('click', resetSimulation);
    }

    async function loadContracts() {
        const response = await fetch('data/covenant_list.json',{cache:'no-cache'});
        if (!response.ok) throw new Error('비밀계약 데이터를 불러오지 못했습니다.');
        state.contracts = await response.json();
        let rollRates;
        [editorDefinition,editorParts,rollRates]=await Promise.all(['data/covenant_editor.json','data/covenant_parts.json','data/covenant_roll_rates.json'].map(async url=>{const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error('비밀계약 편집 자료를 불러오지 못했습니다.');return r.json();}));
        targetModel.setCovenantRollRates(rollRates);
        for(const c of state.contracts)c.clientSuitId=editorDefinition.setIds[c.english_name];
        for(const suit of editorDefinition.suits){const c=state.contracts.find(c=>c.clientSuitId===suit.id);if(c)suit.name=c.korean_name;}
        state.selectedContract = state.contracts[0];
        loadPresets();
        loadSavedState();
        const fallback=state.selectedContract.clientSuitId;
        if(!state.editorParts.length)state.editorParts=structuredClone(state.parts);
        for(const parts of [state.editorParts,state.parts,state.targetSimParts])for(const part of parts)part.setId??=fallback;
        for(const mode of ['editor','manual','target'])if(!partsFor(mode).some(part=>part.setId))state[boundKey(mode)]=false;
    }

    function renderAll() {
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetCurrentParts();
        renderTargetParts();
        renderPresetControls();
        renderTotals();
        showResultMessage('전사 시뮬레이션 결과가 여기에 표시됩니다.');
    }

    function renderTargetScopeButtons() {
        renderBoundControls();
        renderSimulatorContract(els.targetScopeButtons,state.targetSimParts,state.targetParts,index=>{
                if (state.targetParts.includes(index)) {
                    if (state.targetParts.length === 1) {
                        const feedback=els.targetScopeButtons.querySelector('.simulator-contract-feedback');
                        if(feedback)feedback.textContent='대상 부위는 하나 이상 선택해야 합니다.';
                        return;
                    }
                    state.targetParts = state.targetParts.filter(partIndex => partIndex !== index);
                } else {
                    state.targetParts = [...state.targetParts, index].sort((a, b) => a - b);
                }
                renderTargetScopeButtons();
                renderTargetCurrentParts();
                renderTargetParts();
                markTargetSettingsChanged();
                els.targetScopeButtons.querySelector(`[data-target-scope-index="${index}"]`)?.focus({preventScroll:true});
        },'target-scope-index');
    }

    function renderSimulatorContract(mount,parts,selected,onSelect,dataKey){
        mount.replaceChildren();mount.dataset.multiselect=String(Array.isArray(selected));
        const hex=document.createElement('div');hex.className='member-hex';mount.append(hex);
        const visuals=parts.map((part,index)=>{
            const id=part.setId??state.selectedContract?.clientSuitId??0,contract=state.contracts.find(c=>c.clientSuitId===id);
            const art=editorParts.find(s=>s.suitId===id)?.parts[index]?.imagePath;
            return{suitId:id,name:contract?.korean_name||'미장착',image:art||contract?.image_path,pieceArt:!!art,empty:!id,bound:!!id&&!!state[boundKey(mount===els.targetScopeButtons?'target':'manual')],setIcon:id?'images/covenant-set/'+id+'.png':null,caption:!id?'미장착':Array.isArray(selected)?(selected.includes(index)?'계산 대상':'대상 제외'):'전사 부위 선택'};
        });
        renderSimulatorCovenantParts(hex,{parts:visuals,hex:true,labelsInside:true,selected,onSelect});
        hex.querySelectorAll('.part-index-button').forEach(button=>{button.setAttribute('data-'+dataKey,button.dataset.partLabel);button.removeAttribute('data-part-label');});
        if(Array.isArray(selected)){const feedback=document.createElement('p');feedback.className='simulator-contract-feedback';feedback.setAttribute('role','status');mount.append(feedback);}
    }

    function renderContract() {
        if (!state.selectedContract) return;
        const selected=state.contracts.find(c=>c.clientSuitId===partsFor(pickerMode)[pickPosition==null?0:pickPosition-1]?.setId)||state.selectedContract;
        els.selectedContractName.textContent = selected.korean_name;
        window.CovenantPicker.render({grid: els.contractGrid, contracts: state.contracts,
            selected: selected.english_name, onSelect: requestContractChange});
    }

    function requestContractChange(contractName) {
        const picker=document.getElementById('covenant-set-dialog');
        if(picker.open){
            const selected=state.contracts.find(c=>c.english_name===contractName);if(!selected)return;
            const parts=partsFor(pickerMode);
            const slots=sharedModel.selectCovenantSet(parts.map(part=>part.setId??0),selected.clientSuitId,pickPosition);
            parts.forEach((part,index)=>part.setId=slots[index]);picker.close();
            if(pickerMode==='target'){renderTargetScopeButtons();renderTargetCurrentParts();renderTargetParts();markTargetSettingsChanged();}
            else {
                const returnView=pickPosition!=null?{part:pickPosition,overview:pickView?.part===pickPosition&&!!pickView?.overview}:pickView;
                if(pickerMode==='manual'){state.manualPreview=null;state.manualResult=null;}
                renderSharedEditor(pickerMode);sharedEditor?.restoreView(returnView);
                if(pickerMode==='manual')renderManual();
                markSettingsChanged();
                const mount=document.getElementById(pickerMode==='manual'?'manual-covenant-editor':'shared-covenant-editor');
                mount.querySelector(pickPosition==null?'.member-contract-actions .member-set-change':'.member-contract-toolbar .member-part-set')?.focus({preventScroll:true});
            }
            return;
        }
        if (!state.selectedContract || contractName === state.selectedContract.english_name) return;
        const nextContract = state.contracts.find(contract => contract.english_name === contractName);
        if (!nextContract) return;
        state.pendingContractName = contractName;
        if (shouldConfirmContractChange()) {
            openContractChangeModal();
            return;
        }
        applyContractChange(contractName);
    }

    function shouldConfirmContractChange() {
        return state.hasUnsavedPresetChanges || hasConfiguredSettings();
    }

    function hasConfiguredSettings() {
        const defaultTargetParts = [0, 1, 2, 3, 4, 5];
        const targetPartsChanged = state.targetParts.length !== defaultTargetParts.length
            || state.targetParts.some((partIndex, index) => partIndex !== defaultTargetParts[index]);
        const manualLockChanged = getManualLockCostMode() !== 'fragment';
        const targetLockChanged = els.targetLockCost && els.targetLockCost.value !== 'fragment';
        return targetPartsChanged
            || manualLockChanged
            || targetLockChanged
            || state.parts.some((part, index) => isPartConfigured(part, index))
            || state.targetSimParts.some((part, index) => isPartConfigured(part, index));
    }

    function isPartConfigured(part, index) {
        const base = createDefaultPart(index);
        if (part.mainOption !== base.mainOption || part.mainLevel !== base.mainLevel || part.lastTouched) return true;
        const substatsChanged = part.substats.some((substat, substatIndex) => {
            const baseSubstat = base.substats[substatIndex];
            return substat.option !== baseSubstat.option
                || substat.level !== baseSubstat.level
                || substat.locked !== baseSubstat.locked;
        });
        if (substatsChanged) return true;
        return part.goals.some((goal, goalIndex) => {
            const baseGoal = base.goals[goalIndex];
            return goal.option !== baseGoal.option
                || goal.level !== baseGoal.level
                || goal.enabled !== baseGoal.enabled;
        });
    }

    function openContractChangeModal() {
        if (els.contractChangeMessage) {
            els.contractChangeMessage.textContent = state.hasUnsavedPresetChanges
                ? '현재 세팅이 프리셋으로 저장되지 않았습니다. 저장하지 않고 비밀계약을 변경할까요?'
                : '현재 세팅이 초기화됩니다. 비밀계약을 변경할까요?';
        }
        els.contractChangeModal.classList.add('show');
    }

    function closeContractChangeModal() {
        state.pendingContractName = '';
        els.contractChangeModal.classList.remove('show');
    }

    function confirmContractChange() {
        const contractName = state.pendingContractName;
        closeContractChangeModal();
        if (contractName) applyContractChange(contractName);
    }

    function applyContractChange(contractName) {
        const nextContract = state.contracts.find(contract => contract.english_name === contractName);
        if (!nextContract) return;
        state.selectedContract = nextContract;
        resetSettingsForContract();
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetParts();
        renderTotals();
        saveCurrentState();
        showResultMessage('비밀계약을 변경하고 세팅을 초기화했습니다.');
    }

    function resetSettingsForContract() {
        cancelTargetSimulation();
        state.resultStatuses={manual:{message:'',type:''},target:{message:'',type:''}};
        state.selectedPart = 0;
        state.mode = 'editor';
        state.targetParts = [0, 1, 2, 3, 4, 5];
        state.parts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.targetSimParts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.manualPreview = null;
        state.manualResult = null;
        state.targetResult = null;
        state.totals = createEmptyTotals();
        state.hasUnsavedPresetChanges = false;
        const manualLockInput = document.querySelector('input[name="manual-lock-cost"][value="fragment"]');
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) els.targetLockCost.value = 'fragment';
    }

    function renderParts() {
        if(state.mode==='editor')renderSharedEditor('editor');
        else if(state.mode==='manual'&&document.getElementById('manual-setting-dialog').open)renderSharedEditor('manual');
    }

    function renderSharedEditor(mode='editor'){
        const mount=document.getElementById(mode==='manual'?'manual-covenant-editor':'shared-covenant-editor');
        if(!mount||!editorDefinition)return;
        const previousView=mode==='editor'?editorView:null;
        mount.replaceChildren();
        const source=partsFor(mode),key=boundKey(mode);
        sharedOwner=sharedModel.simulatorEquipment(source,{fallbackSetId:0,bound:!!state[key]});
        state[key]=sharedOwner.contractBound;
        const owner=sharedOwner;
        const editor=renderSharedCovenantEditor(mount,{owner,catalog:editorDefinition,metadata:editorDefinition.metadata,contracts:state.contracts,parts:editorParts,
            initialPart:mode==='manual'?state.selectedPart:state.editorPart??-1,pickOnPartSelect:true,allowEmptyOptions:false,
            onPick:position=>{pickView=editor?.getView();openSetPicker(mode,position);},
            onPartChange:(index,view)=>{
                if(mode==='editor'){state.editorPart=index;editorView=view;}
                else if(index>=0&&index!==state.selectedPart){
                    state.selectedPart=index;state.manualPreview=null;state.manualResult=null;
                    setManualStatus('','');renderManual();
                }
                saveCurrentState();
            },
            onChange:updated=>{
                const current=partsFor(mode),next=sharedModel.applyEditorEquipment(updated,current);
                const changed=next.some((part,index)=>{
                    const before=current[index];
                    return part.setId!==before.setId||part.mainOption!==before.mainOption||part.mainLevel!==before.mainLevel||JSON.stringify(part.substats)!==JSON.stringify(before.substats);
                });
                if(!changed)next.forEach((part,index)=>part.lastTouched=current[index].lastTouched);
                if(mode==='editor')state.editorParts=next;else state.parts=next;
                state[key]=updated.contractBound;
                if(mode==='manual'){if(changed){state.manualPreview=null;state.manualResult=null;}renderManual();}
                markSettingsChanged();
            },
            onReset:()=>{renderSharedEditor(mode);if(mode==='manual')renderManual();}
        });
        sharedEditor=editor;
        if(previousView?.overview&&previousView.part>0)editor.restoreView(previousView);
    }

    function syncResourceSwitches(){
        for(const button of document.querySelectorAll('[data-resource-switch]')){
            const quill=(button.dataset.resourceSwitch==='manual'?getManualLockCostMode():els.targetLockCost.value)==='quill';
            button.setAttribute('aria-checked',String(quill));
            for(const label of button.parentElement.querySelectorAll('[data-priority-label]'))label.classList.toggle('active',label.dataset.priorityLabel===(quill?'quill':'fragment'));
        }
    }

    function renderBoundControls(){
        syncResourceSwitches();
        for(const input of document.querySelectorAll('[data-simulator-bound]')){
            const mode=input.dataset.simulatorBound,key=boundKey(mode),equipped=partsFor(mode).some(part=>!!part.setId);
            if(!equipped)state[key]=false;
            input.checked=equipped&&!!state[key];input.disabled=!equipped;
        }
    }

    function renderMode() {
        els.resetSimBtn.textContent={editor:'세팅 초기화',manual:'전사 초기화',target:'목표 초기화'}[state.mode];
        els.modeTabs.forEach(tab => {
            const isActive = tab.dataset.modeTab === state.mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex=isActive?0:-1;
            applyModeTabVisualState(tab, isActive);
        });
        els.editorPanel.classList.toggle('hidden', state.mode !== 'editor');
        els.manualPanel.classList.toggle('hidden', state.mode !== 'manual');
        document.querySelector('.capture-panel').hidden=state.mode==='editor';
        const ability=document.getElementById('simulator-ability-panel');ability.hidden=state.mode==='editor';
        if(state.mode!=='editor'){
            const workspace=document.querySelector(state.mode==='manual'?'.transcription-workspace':'.target-contract-toolbar');
            workspace.querySelector('.simulator-side-panel').append(document.querySelector('.capture-panel'));
            workspace.querySelector('.workspace-footer').append(els.resultStatus);
            workspace.querySelector('.simulator-side-panel').append(ability);
        }
        placeStorageStatus();renderBoundControls();
        document.querySelector('.covenant-page').dataset.workspaceMode=state.mode;
        els.targetPanel.classList.toggle('hidden', state.mode !== 'target');
        if (state.mode === 'manual') renderManual();
        if (state.mode === 'target') {
            renderTargetScopeButtons();
            renderTargetCurrentParts();
            renderTargetParts();
        }
        renderResultSummary();
    }

    function applyModeTabVisualState(tab, isActive) {
        tab.style.setProperty('background-color', isActive ? '#2a2a2e' : '#3f3f46', 'important');
        tab.style.setProperty('border-color', isActive ? '#55555e' : '#444', 'important');
        tab.style.setProperty('border-bottom-color', isActive ? '#2a2a2e' : '#444', 'important');
        tab.style.setProperty('color', isActive ? '#ffc107' : '#9a9a9f', 'important');
        tab.style.setProperty('font-weight', isActive ? '800' : '600', 'important');
    }

    function renderManual() {
        renderBoundControls();
        const part = getSelectedPart();
        const set=state.contracts.find(c=>c.clientSuitId===(part.setId??state.selectedContract?.clientSuitId));
        els.manualRerollBtn.disabled=!set;
        els.manualPartTitle.textContent = '전사';
        renderTranscriptionCurrent(part,set);
        els.manualBeforeCompletion.textContent = `${formatNumber(getPartCompletion(part), 1)}%`;
        els.manualAfterCompletion.textContent = state.manualPreview
            ? `${formatNumber(getPartCompletion(part, state.manualPreview), 1)}%`
            : '-';
        els.manualCost.textContent = formatCost(getRerollCost(countLocked(part.substats), getManualLockCostMode()));
        renderManualPreview();
        renderResultSummary();
    }

    function renderTranscriptionCurrent(part,set) {
        const buttons=document.getElementById('manual-part-buttons');
        renderSimulatorContract(buttons,state.parts,state.selectedPart,index=>{
            if(index===state.selectedPart){buttons.querySelector(`[data-transcription-part="${index}"]`)?.focus({preventScroll:true});return;}
            state.selectedPart=index;state.manualPreview=null;state.manualResult=null;setManualStatus('','');renderManual();saveCurrentState();
            buttons.querySelector(`[data-transcription-part="${state.selectedPart}"]`)?.focus({preventScroll:true});
        },'transcription-part');
        document.getElementById('transcription-current-title').textContent=getContractPartName(state.selectedPart);
        document.getElementById('transcription-current-main').innerHTML=set?`${renderAttributeIcon(part.mainOption,true)}<span>주옵션 · ${escapeHtml(getOptionName(part.mainOption))} / Lv. ${part.mainLevel}</span>`:'세팅 편집에서 비밀계약을 먼저 장착하세요.';
        const rows=document.getElementById('transcription-current-stats');
        rows.innerHTML=part.substats.map((substat,index)=>`<div class="transcription-stat"><div><span class="workspace-help">부옵션 ${index+1}</span><p>${renderAttributeIcon(substat.option,true)}<span>${escapeHtml(getSubstatText(substat))}</span></p></div><button type="button" class="contract-substat-lock" data-substat-lock="${index}" aria-label="${index+1}번 부옵 잠금" aria-pressed="${substat.locked}" ${!set||substat.option==='none'?'disabled':''}><img src="images/covenant-ui/UI_Common_D_Image_Unlock${substat.locked?'06':'05'}.png" width="78" height="42" alt=""></button></div>`).join('');
        rows.querySelectorAll('button').forEach(button=>button.onclick=()=>{
            const index=Number(button.dataset.substatLock);toggleManualLock(index);rows.querySelector(`[data-substat-lock="${index}"]`)?.focus({preventScroll:true});
        });
    }

    function renderManualPreview() {
        if (!state.manualPreview) {
            els.manualResult.className = 'result-list empty-result';
            els.manualResult.textContent = '—';
            els.manualApplyBtn.disabled = true;
            return;
        }
        els.manualResult.className = 'result-list';
        els.manualResult.innerHTML = state.manualPreview.map(renderStatLine).join('');
        els.manualApplyBtn.disabled = false;
    }

    function renderTargetParts() {
        const indexes = getTargetPartIndexes();
        renderTargetEditorNavigation();
        els.targetParts.innerHTML = indexes.map(index => {
            const part = state.targetSimParts[index];
            return `
                <section class="target-part-card" data-target-part="${index}" ${index===state.targetEditorPart?'':'hidden'}>
                    <div class="target-part-header">
                        <div class="target-part-title">${escapeHtml(getContractPartName(index,state.targetSimParts))}</div>
                        <div class="contract-picker">
                            <label class="field-label">주옵</label>
                            <select class="sim-select target-main-option" aria-label="${ROMANS[index]} 부위 목표 주옵션">
                                <option value="none" ${part.mainOption==='none'?'selected':''}>미설정</option>
                                ${MAIN_OPTIONS[index].map(optionId => `<option value="${optionId}" ${optionId === part.mainOption ? 'selected' : ''}>${escapeHtml(getOptionName(optionId))}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="target-goals">
                        ${range(0, 2).map(goalIndex => {
                            const goal = part.goals[goalIndex];
                            return `
                                <div class="target-goal-row" data-goal-index="${goalIndex}">
                                    <select class="sim-select target-goal-option" aria-label="${ROMANS[index]} 부위 목표 ${goalIndex+1} 옵션">
                                        ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === goal.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                    </select>
                                    <select class="sim-select target-goal-level" aria-label="${ROMANS[index]} 부위 목표 ${goalIndex+1} 최소 레벨">
                                        ${range(1, 8).map(level => `<option value="${level}" ${level === goal.level ? 'selected' : ''}>Lv ${level} 이상</option>`).join('')}
                                    </select>
                                    <label class="target-goal-toggle">
                                        <input type="checkbox" class="goal-enabled" ${goal.enabled ? 'checked' : ''} aria-label="${ROMANS[index]} 부위 목표 ${goalIndex+1} 사용">
                                        <img class="goal-unlocked" src="images/covenant-ui/UI_Common_D_Image_Unlock05.png" width="78" height="42" alt="">
                                        <img class="goal-locked" src="images/covenant-ui/UI_Common_D_Image_Unlock06.png" width="78" height="42" alt="">
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');
        els.targetParts.querySelectorAll('[data-target-part]').forEach(card => {bindTargetCard(card);renderTargetOptionIcons(card);});
    }

    function renderTargetCurrentParts() {
        const indexes = getTargetPartIndexes();
        renderTargetEditorNavigation();
        els.targetCurrentParts.innerHTML = indexes.map(index => {
            const part = state.targetSimParts[index];
            return `
                <section class="target-part-card" data-target-current-part="${index}" ${index===state.targetEditorPart?'':'hidden'}>
                    <div class="target-part-header">
                        <div class="target-part-title">${escapeHtml(getContractPartName(index,state.targetSimParts))}</div>
                        <div class="muted-text target-current-caption">현재 부옵</div>
                    </div>
                    <div class="target-goals">
                        ${part.substats.map((substat, substatIndex) => `
                            <div class="target-current-row" data-substat-index="${substatIndex}">
                                <select class="sim-select target-current-option" aria-label="${ROMANS[index]} 부위 현재 부옵션 ${substatIndex+1}">
                                    <option value="none" ${substat.option==='none'?'selected':''}>없음</option>
                                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                </select>
                                <select class="sim-select target-current-level" aria-label="${ROMANS[index]} 부위 현재 부옵션 ${substatIndex+1} 레벨" ${substat.option==='none'?'disabled':''}>
                                    ${range(1, 8).map(level => `<option value="${level}" ${level === substat.level ? 'selected' : ''}>Lv ${level}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }).join('');
        els.targetCurrentParts.querySelectorAll('[data-target-current-part]').forEach(card => {bindTargetCurrentCard(card);renderTargetOptionIcons(card);});
    }

    function renderTargetEditorNavigation(){
        syncResourceSwitches();
        const indexes=getTargetPartIndexes().sort((a,b)=>a-b);
        if(!indexes.includes(state.targetEditorPart))state.targetEditorPart=indexes[0];
        const mount=document.getElementById('target-editor-part-buttons');
        mount.innerHTML=indexes.map(index=>`<button type="button" data-target-edit-part="${index}" aria-pressed="${index===state.targetEditorPart}" aria-label="${ROMANS[index]} 부위 편집">${ROMANS[index]}</button>`).join('');
        mount.querySelectorAll('button').forEach(button=>button.onclick=()=>{
            state.targetEditorPart=Number(button.dataset.targetEditPart);
            renderTargetCurrentParts();renderTargetParts();saveCurrentState();
            mount.querySelector(`[data-target-edit-part="${state.targetEditorPart}"]`)?.focus({preventScroll:true});
        });
        const current=state.targetEditorView==='current';
        document.getElementById('target-current-section').hidden=!current;
        document.getElementById('target-goals-section').hidden=current;
        document.querySelectorAll('[data-target-editor-view]').forEach(tab=>{
            const active=(tab.dataset.targetEditorView==='current')===current;
            tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
        });
    }

    function renderTargetOptionIcons(card) {
        for(const select of card.querySelectorAll('.target-main-option,.target-goal-option,.target-current-option')){
            const field=document.createElement('div');field.className='target-option-field';
            const caption=document.createElement('span');caption.className='target-option-caption';
            const choices=document.createElement('div');choices.className='target-option-icons';choices.setAttribute('role','group');choices.setAttribute('aria-label',select.getAttribute('aria-label'));
            select.hidden=true;select.after(field);field.append(caption,choices);
            const allowEmpty=[...select.options].some(option=>option.value==='none');
            const refresh=()=>{caption.textContent=getOptionName(select.value);for(const button of choices.children)button.setAttribute('aria-pressed',String(button.dataset.option===select.value));};
            for(const option of select.options){
                if(option.value==='none')continue;
                const button=document.createElement('button');button.type='button';button.dataset.option=option.value;button.title=option.textContent;button.setAttribute('aria-label',option.textContent);button.innerHTML=renderAttributeIcon(option.value,true);
                button.onclick=()=>{select.value=allowEmpty&&select.value===option.value?'none':option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();};
                choices.append(button);
            }
            select.addEventListener('change',refresh);refresh();
        }
    }

    function bindTargetCurrentCard(card) {
        const partIndex = Number(card.dataset.targetCurrentPart);
        const part = state.targetSimParts[partIndex];
        card.querySelectorAll('[data-substat-index]').forEach(row => {
            const substatIndex = Number(row.dataset.substatIndex);
            row.querySelector('.target-current-option').addEventListener('change', event => {
                part.substats[substatIndex].option = event.target.value;
                row.querySelector('.target-current-level').disabled=event.target.value==='none';
                markTargetSettingsChanged();
            });
            row.querySelector('.target-current-level').addEventListener('change', event => {
                part.substats[substatIndex].level = Number(event.target.value);
                markTargetSettingsChanged();
            });
        });
    }

    function bindTargetCard(card) {
        const partIndex = Number(card.dataset.targetPart);
        const part = state.targetSimParts[partIndex];
        card.querySelector('.target-main-option').addEventListener('change', event => {
            part.mainOption = event.target.value;
            markTargetSettingsChanged();
        });
        card.querySelectorAll('[data-goal-index]').forEach(row => {
            const goalIndex = Number(row.dataset.goalIndex);
            row.querySelector('.target-goal-option').addEventListener('change', event => {
                part.goals[goalIndex].option = event.target.value;
                markTargetSettingsChanged();
            });
            row.querySelector('.target-goal-level').addEventListener('change', event => {
                part.goals[goalIndex].level = Number(event.target.value);
                markTargetSettingsChanged();
            });
            row.querySelector('.goal-enabled').addEventListener('change', event => {
                part.goals[goalIndex].enabled = event.target.checked;
                markTargetSettingsChanged();
            });
        });
    }

    function manualReroll() {
        setStatus('','');
        const part = getSelectedPart();
        const cost = getRerollCost(countLocked(part.substats), getManualLockCostMode());
        state.manualPreview = rerollSubstats(part.substats);
        addTotals(state.totals, cost);
        state.totals.rerolls += 1;
        state.manualResult = {
            type: 'manual',
            partIndex:state.selectedPart,
            contractBound:!!state.contractBound,
            contract: getPresetContractName(state.parts),
            part: getContractPartName(state.selectedPart),
            attempts: state.totals.rerolls,
            cost: { ...state.totals },
            finalSubstats: cloneSubstats(state.manualPreview),
            allParts: getAllPartSnapshots(state.selectedPart, state.manualPreview)
        };
        renderManual();
        renderTotals();
        renderResultSummary('전사 결과가 생성되었습니다. 교체 버튼으로 현재 부옵에 반영할 수 있습니다.');
        saveCurrentState();
    }

    function applyManualPreview() {
        if (!state.manualPreview) return;
        if(!state.manualResult||state.manualResult.partIndex!==state.selectedPart){
            state.manualPreview=null;state.manualResult=null;renderManual();saveCurrentState();
            setManualStatus('선택한 부위에서 다시 전사하세요.','error');return;
        }
        getSelectedPart().substats = cloneSubstats(state.manualPreview);
        getSelectedPart().lastTouched = true;
        if (state.manualResult) {
            state.manualResult.finalSubstats = cloneSubstats(state.manualPreview);
            state.manualResult.allParts = getAllPartSnapshots();
        }
        state.manualPreview = null;
        renderParts();
        renderManual();
        renderResultSummary('전사 결과를 현재 부옵으로 교체했습니다.');
        markSettingsChanged();
    }

    async function runTargetSimulation() {
        if (state.isSimulating) return;
        const config = getTargetConfig();
        if(config.error){setStatus(config.error,'error');return;}
        if (!config.targets.length) {
            setStatus('목표로 사용할 부옵을 하나 이상 선택해주세요.', 'error');
            return;
        }
        const startMessage = '이번 실행 기준: 현재 세팅에 입력된 부옵 상태에서 시작했습니다.';
        await executeTargetSimulation(config, startMessage);
    }

    async function executeTargetSimulation(config, startMessage) {
        const run={cancelled:false};activeTargetRun=run;
        state.targetResult=null;
        if(state.mode==='target')renderResultSummary();
        setSimulationBusy(true, '목표 시뮬레이션을 계산 중입니다...');
        try {
            const result = await simulateUntilTargets(config,true,run);
            if(run.cancelled)return;
            result.startMessage = startMessage;
            state.targetResult = result;
            state.targetResult.allParts = getTargetResultPartSnapshots(result);
            setStatus('','');
            renderTargetParts();
            if(state.mode==='target')renderResultSummary('목표까지 시뮬레이션을 완료했습니다.');
        } catch(error){
            if(!run.cancelled)setStatus(error.message||'목표 시뮬레이션을 다시 실행하세요.','error');
        } finally {
            if(activeTargetRun===run){activeTargetRun=null;setSimulationBusy(false);saveCurrentState();}
        }
    }

    function cancelTargetSimulation(message=''){
        if(!activeTargetRun)return;
        activeTargetRun.cancelled=true;activeTargetRun=null;
        setSimulationBusy(false);
        setStatus(message,'');
    }

    async function simulateUntilTargets(config, shouldYield = true, run={cancelled:false}) {
        const totalCost = createEmptyTotals();
        const partResults = [];
        let attempts = 0;
        for (const targetPart of config.targetsByPart) {
            let current = cloneSubstats(config.snapshotParts[targetPart.partIndex].substats);
            while (!matchesGoals(current, targetPart.goals)) {
                if(run.cancelled)throw Error('중단되었습니다.');
                const step = advanceTowardGoals(current, targetPart.goals, config,targetPart.partIndex+1);
                current = step.substats;
                addScaledTotals(totalCost, step.cost, step.attempts);
                attempts += step.attempts;
                if(shouldYield&&attempts%32===0)await yieldToBrowser();
            }
            partResults.push({
                partIndex: targetPart.partIndex,
                goals: targetPart.goals,
                finalSubstats: current.map(substat => ({ ...substat, locked: false }))
            });
            if (shouldYield) await yieldToBrowser();
            if(run.cancelled)throw Error('중단되었습니다.');
        }
        return {
            type: 'target',
            contractBound:config.contractBound,
            contract: config.contract,
            scope: config.scopeLabel,
            attempts,
            cost: totalCost,
            partResults,
            snapshotParts:config.snapshotParts
        };
    }

    function getTargetConfig() {
        const snapshotParts=structuredClone(state.targetSimParts).map(part=>({...part,setId:part.setId??state.selectedContract?.clientSuitId??0}));
        const targetsByPart = getTargetPartIndexes().map(partIndex => {
            const goals = snapshotParts[partIndex].goals
                .filter(goal => goal.enabled)
                .map(goal => ({ option: goal.option, level: goal.level }));
            return { partIndex, goals };
        }).filter(item => item.goals.length > 0);
        const empty=targetsByPart.find(({partIndex})=>!(snapshotParts[partIndex].setId??state.selectedContract?.clientSuitId));
        return {
            error:empty?ROMANS[empty.partIndex]+' 부위의 비밀계약을 먼저 장착하세요.':'',
            snapshotParts,
            contractBound:!!state.targetBound,
            contract:state.selectedContract?.korean_name||'',
            targetsByPart,
            targets: targetsByPart.flatMap(item => item.goals),
            scopeLabel: state.targetParts.length === 6 ? '전체' : state.targetParts.map(index => ROMANS[index]).join(', '),
            lockStrategy: 'two',
            lockCostMode: els.targetLockCost.value
        };
    }

    function getTargetPartIndexes() {
        return TARGET_PART_ORDER.filter(index => state.targetParts.includes(index));
    }

    function matchesGoals(substats, goals) {
        return targetModel.covenantGoalsMet(substats,goals);
    }

    function advanceTowardGoals(current, goals, config,position) {
        const step=targetModel.rollCovenantTowardGoals(current,goals,{position,maxLocks:config.lockStrategy==='none'?0:config.lockStrategy==='one'?1:2});
        return {
            attempts:1,
            cost:getRerollCost(step.lockedCount,config.lockCostMode),
            substats:step.substats
        };
    }

    function rerollSubstats(substats) {
        return targetModel.rerollCovenantSubstats(substats,{position:state.selectedPart+1});
    }

    function toggleManualLock(index) {
        const substats = getSelectedPart().substats;
        if (!substats[index].locked && countLocked(substats) >= 2) {
            setManualStatus('부옵 잠금은 최대 2개까지 가능합니다.', 'error');
            return;
        }
        substats[index].locked = !substats[index].locked;
        setManualStatus('', '');
        state.manualPreview = null;
        renderParts();
        renderManual();
        markSettingsChanged();
    }

    function renderTotals() {
        return;
    }

    function renderResultSummary(message) {
        const result = getActiveResult();
        document.getElementById('result-title').textContent='결과';
        document.getElementById('ability-summary').innerHTML=renderCovenantStatGrid(getActiveStatParts(result),activeBound());
        document.querySelector('.capture-panel').hidden=state.mode==='editor'||!result;
        if (!result) {
            els.resultSummary.replaceChildren();
            renderResultStatus();
            return;
        }
        const cost = result.cost;
        const attempts = formatInteger(result.attempts);
        els.resultSummary.innerHTML = `
            ${renderResultDetails(result)}
            <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">전사 횟수</span><span class="summary-value">${attempts}회</span></div>
                <div class="summary-item"><span class="summary-label">금권</span><span class="summary-value">${formatNumber(cost.gold, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">천면 인장</span><span class="summary-value">${formatNumber(cost.seals, 1)}</span></div>
                ${cost.fragments?`<div class="summary-item"><span class="summary-label">잔본</span><span class="summary-value">${formatNumber(cost.fragments,1)}</span></div>`:''}
                ${cost.quills?`<div class="summary-item"><span class="summary-label">깃펜</span><span class="summary-value">${formatNumber(cost.quills,1)}</span></div>`:''}
            </div>
        `;
        renderResultStatus();
    }

    function renderResultDetails(result) {
        if (result.type === 'manual') {
            return renderAllPartResults((result.allParts || getAllPartSnapshots()).filter(part=>part.partIndex===(result.partIndex??state.selectedPart)));
        }
        if (result.type === 'target') {
            return renderAllPartResults((result.allParts || getAllTargetPartSnapshots()).filter(part=>result.partResults.some(target=>target.partIndex===part.partIndex)));
        }
        return '';
    }

    function getActiveResult() {
        return state.mode === 'target' ? state.targetResult : state.manualResult;
    }

    function getActiveStatParts(result) {
        if (result && result.type === 'target') return result.allParts || getAllTargetPartSnapshots();
        if (result && result.type === 'manual') return result.allParts || getAllPartSnapshots();
        return state.mode === 'target' ? getAllTargetPartSnapshots() : getAllPartSnapshots();
    }

    function renderAllPartResults(parts) {
        return `<div class="part-result-grid">${parts.map(part => `
            <div class="part-result-card">
                <h4>${escapeHtml(ROMANS[part.partIndex])}</h4>
                <div class="part-main-label">${renderAttributeIcon(part.mainOption,true)}<span class="main-option-name">${escapeHtml(getOptionName(part.mainOption))}</span><span>Lv ${part.mainLevel}</span></div>
                ${part.substats.map(renderCompactStatLine).join('')}
            </div>
        `).join('')}</div>`;
    }

    function renderCovenantStatGrid(parts = getAllPartSnapshots(),bound=!!state.contractBound) {
        const totals = getCovenantStatTotals(parts,bound);
        return `<section class="covenant-stat-summary" aria-label="비밀계약 능력치"><dl class="covenant-result-totals contract-attribute-totals">${totals.map(option=>`<div><dt>${renderAttributeIcon(option.id,true)}<span>${escapeHtml(option.name)}</span></dt><dd>${escapeHtml(formatStatValue(option.value,option.unit))}</dd></div>`).join('')}</dl><p class="contract-totals-note is-spacer" aria-hidden="true">주옵션 · 부옵션 · 3세트 효과 합계</p></section>`;
    }

    function getCovenantStatTotals(parts = getAllPartSnapshots(),bound=!!state.contractBound) {
        const values=sharedModel.simulatorTotals(parts,editorDefinition,{fallbackSetId:state.selectedContract?.clientSuitId||0,bound});
        return OPTIONS.map(option=>({...option,value:values[sharedModel.simulatorAttributeIds[option.id]]||0}));
    }

    function showResultMessage(message) {
        renderResultSummary(message);
    }

    function setStatus(message, type) {
        state.resultStatuses[state.mode==='target'?'target':'manual']={message,type};
        renderResultStatus();
    }

    function renderResultStatus(){
        const {message,type}=state.resultStatuses[state.mode==='target'?'target':'manual'];
        els.resultStatus.textContent = message;
        els.resultStatus.className = `result-status ${type || ''}`.trim();
    }

    function setSimulationBusy(isBusy, message = '') {
        state.isSimulating = isBusy;
        if (els.runTargetBtn) els.runTargetBtn.disabled = isBusy;
        const stop=document.getElementById('stop-target-btn');if(stop)stop.hidden=!isBusy;
        document.getElementById('covenant-help').disabled=isBusy;
        if (message) setStatus(message, '');
    }

    function yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function setManualStatus(message, type) {
        if(state.mode==='editor')document.getElementById('preset-status').textContent=message;
        if (state.mode==='editor'||!els.manualStatus) return;
        els.manualStatus.textContent = message;
        els.manualStatus.className = `manual-status ${type || ''}`.trim();
    }

    function markSettingsChanged() {
        if(state.mode==='editor')state.hasUnsavedPresetChanges = true;
        saveCurrentState();
    }

    function markTargetSettingsChanged() {
        cancelTargetSimulation();
        state.resultStatuses.target={message:'',type:''};
        state.targetResult = null;
        if (state.mode === 'target') renderResultSummary('목표 설정이 변경되었습니다. 목표까지 시뮬레이션을 다시 실행해주세요.');
        markSettingsChanged();
    }

    function saveCurrentState() {
        return writeStoredData(STORAGE_KEY, createStateSnapshot());
    }

    function placeStorageStatus(){
        const status=document.getElementById('storage-status'),dialog=document.getElementById('manual-setting-dialog');
        if(dialog.open)dialog.append(status);
        else if(state.mode==='editor')document.querySelector('#editor-panel>.preset-controls').after(status);
        else document.querySelector(`#${state.mode}-panel .workspace-footer`).append(status);
        return status;
    }

    function writeStoredData(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            document.getElementById('storage-status').textContent='';
            return true;
        } catch (error) {
            console.warn('비밀계약 시뮬레이터 상태 저장에 실패했습니다.', error);
            const status=placeStorageStatus();
            const context=document.getElementById('manual-setting-dialog').open?'manual-dialog':state.mode;
            const firstFailure=!status.textContent||status.dataset.failureContext!==context;
            status.dataset.failureContext=context;
            status.textContent='이 기기에 저장하지 못했습니다. 저장 공간과 브라우저의 저장 허용 설정을 확인하세요.';
            if(firstFailure)status.scrollIntoView({block:'nearest'});
            return false;
        }
    }

    function loadSavedState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved) applyStateSnapshot(saved);
        } catch (error) {
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
    }

    function createStateSnapshot() {
        return {
            version: 3,
            editorParts:structuredClone(state.editorParts),editorBound:!!state.editorBound,targetBound:!!state.targetBound,
            manualPreview:structuredClone(state.manualPreview),manualResult:structuredClone(state.manualResult),targetResult:structuredClone(state.targetResult),totals:{...state.totals},
            contractBound:!!state.contractBound,
            selectedContract: state.selectedContract ? state.selectedContract.english_name : '',
            selectedPart: state.selectedPart,
            mode: state.mode,
            manualLockCostMode: getManualLockCostMode(),
            targetLockCostMode: els.targetLockCost ? els.targetLockCost.value : 'fragment',
            hasUnsavedPresetChanges: state.hasUnsavedPresetChanges,
            targetParts: [...state.targetParts],
            targetEditorPart: state.targetEditorPart,
            targetEditorView: state.targetEditorView,
            parts: state.parts.map(part => ({
                setId:part.setId,
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: part.substats.map(substat => ({ ...substat })),
                goals: part.goals.map(goal => ({ ...goal })),
                lastTouched: !!part.lastTouched
            })),
            targetSimParts: state.targetSimParts.map(part => ({
                setId:part.setId,
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: part.substats.map(substat => ({ ...substat })),
                goals: part.goals.map(goal => ({ ...goal })),
                lastTouched: !!part.lastTouched
            }))
        };
    }

    function applyStateSnapshot(snapshot) {
        cancelTargetSimulation();
        state.resultStatuses={manual:{message:'',type:''},target:{message:'',type:''}};
        const contract = state.contracts.find(item => item.english_name === snapshot.selectedContract);
        if (contract) state.selectedContract = contract;
        state.editorPart=-1;editorView=null;
        state.contractBound=!!snapshot.contractBound;
        state.selectedPart = clampIndex(snapshot.selectedPart, 0, 5, 0);
        state.mode = ['editor','manual','target'].includes(snapshot.mode)?snapshot.mode:'editor';
        state.targetParts = normalizeTargetParts(snapshot.targetParts);
        state.targetEditorPart=clampIndex(snapshot.targetEditorPart,0,5,0);
        state.targetEditorView=snapshot.targetEditorView==='current'?'current':'goals';
        state.parts = Array.from({ length: 6 }, (_, index) => normalizePartSnapshot(snapshot.parts && snapshot.parts[index], index));
        state.editorParts=Array.from({length:6},(_,index)=>normalizePartSnapshot((snapshot.editorParts||snapshot.parts)?.[index],index));
        state.editorBound=snapshot.version>=3?!!snapshot.editorBound:!!snapshot.contractBound;
        state.targetBound=snapshot.version>=3?!!snapshot.targetBound:!!snapshot.contractBound;
        const storedTargetParts = snapshot.targetSimParts || snapshot.parts;
        state.targetSimParts = Array.from({ length: 6 }, (_, index) => normalizePartSnapshot(storedTargetParts && storedTargetParts[index], index));
        state.hasUnsavedPresetChanges = !!snapshot.hasUnsavedPresetChanges;
        state.manualPreview = null;
        state.manualResult = null;
        state.targetResult = null;
        if(snapshot.version>=3){
            state.manualPreview=Array.isArray(snapshot.manualPreview)&&snapshot.manualPreview.length===3?snapshot.manualPreview.map((sub,index)=>normalizeSubstat(sub,state.parts[state.selectedPart].substats[index])):null;
            state.manualResult=restoreResult(snapshot.manualResult,'manual');state.targetResult=restoreResult(snapshot.targetResult,'target');
            if(state.manualPreview&&(!state.manualResult||state.manualResult.partIndex!==state.selectedPart)){
                state.manualPreview=null;state.manualResult=null;
            }
            for(const key of Object.keys(state.totals))if(Number.isFinite(snapshot.totals?.[key])&&snapshot.totals[key]>=0)state.totals[key]=snapshot.totals[key];
        }
        applyStoredControlValues(snapshot);
    }

    function loadPresets() {
        try {
            const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY));
            state.presets = Array.isArray(presets) ? presets.filter(preset => preset && preset.id && preset.snapshot) : [];
        } catch (error) {
            state.presets = [];
            try { localStorage.removeItem(PRESET_STORAGE_KEY); } catch {}
        }
    }


    function persistPresets(presets=state.presets) {
        return writeStoredData(PRESET_STORAGE_KEY, presets);
    }


    function renderPresetControls() {
        document.querySelectorAll('[data-equipment-preset]').forEach(select=>{const value=select.value;select.innerHTML='<option value="">세팅 선택</option>'+state.presets.map(preset=>`<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('');if(state.presets.some(preset=>preset.id===value))select.value=value;});
        if (!els.presetSelect) return;
        const selectedId = els.presetSelect.value;
        els.presetSelect.innerHTML = [
            '<option value="">프리셋 선택</option>',
            ...state.presets.map(preset => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
        ].join('');
        if (state.presets.some(preset => preset.id === selectedId)) {
            els.presetSelect.value = selectedId;
        }
    }


    function savePreset() {
        const selectedId = els.presetSelect.value;
        const existing = state.presets.find(preset => preset.id === selectedId);
        const inputName = els.presetNameInput.value.trim();
        const name = inputName || (existing ? existing.name : getDefaultPresetName());
        if (!name) return;
        const now = new Date().toISOString();
        const activePresetId=existing?.id||`preset-${crypto.randomUUID()}`;
        const preset={...existing,id:activePresetId,name,createdAt:existing?.createdAt||now,updatedAt:now,snapshot:{version:1,selectedContract:state.selectedContract.english_name,parts:structuredClone(state.editorParts),contractBound:!!state.editorBound}};
        const next=existing?state.presets.map(item=>item.id===activePresetId?preset:item):[...state.presets,preset];
        if(!persistPresets(next)){setManualStatus('프리셋을 저장하지 못했습니다. 기존 프리셋은 유지됩니다.','error');return;}
        state.presets=next;
        state.hasUnsavedPresetChanges = false;
        setManualStatus('','');window.MorimensToast.show(`프리셋 "${name}" 저장됨`);
        els.presetNameInput.value = '';
        renderPresetControls();
        els.presetSelect.value = activePresetId;
        saveCurrentState();
    }

    function loadSelectedPreset() {
        const preset = state.presets.find(item => item.id === els.presetSelect.value);
        if (!preset) {
            setManualStatus('불러올 프리셋을 선택해주세요.', 'error');
            return;
        }
        state.editorParts=Array.from({length:6},(_,index)=>normalizePartSnapshot((preset.snapshot.editorParts||preset.snapshot.parts)?.[index],index));
        const fallback=state.contracts.find(c=>c.english_name===preset.snapshot.selectedContract)?.clientSuitId||state.contracts[0].clientSuitId;
        for(const part of state.editorParts)part.setId??=fallback;
        state.editorBound=!!(preset.snapshot.editorBound??preset.snapshot.contractBound);
        state.mode='editor';
        state.hasUnsavedPresetChanges = false;
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetParts();
        renderPresetControls();
        renderTotals();
        saveCurrentState();
        setManualStatus('','');window.MorimensToast.show(`${preset.name} 불러옴`);
    }

    function deleteSelectedPreset() {
        const preset = state.presets.find(item => item.id === els.presetSelect.value);
        if (!preset) {
            setManualStatus('삭제할 프리셋을 선택해주세요.', 'error');
            return;
        }
        const next=state.presets.filter(item=>item.id!==preset.id);
        if(!persistPresets(next)){setManualStatus('프리셋을 삭제하지 못했습니다. 기존 프리셋은 유지됩니다.','error');return;}
        state.presets=next;
        els.presetSelect.value = '';
        renderPresetControls();
        setManualStatus('','');window.MorimensToast.show(`프리셋 "${preset.name}" 삭제됨`);
    }

    function applyImportedEquipment(mode,parts,bound,activate=false){
        const next=createStateSnapshot();
        if(activate)next.mode=mode;
        bound=!!bound&&parts.some(part=>!!part.setId);
        if(mode==='manual'){
            next.parts=structuredClone(parts);next.contractBound=bound;next.manualPreview=null;next.manualResult=null;next.totals=createEmptyTotals();
        }else{
            next.targetSimParts=parts.map((part,index)=>({...structuredClone(part),goals:structuredClone(state.targetSimParts[index].goals)}));
            next.targetBound=bound;next.targetResult=null;
        }
        // Persist the candidate first: a failed import must leave every active bank untouched.
        if(!writeStoredData(STORAGE_KEY,next))return false;
        if(mode==='target'||(activate&&state.mode==='target'&&mode!=='target'))cancelTargetSimulation();
        if(activate)state.mode=mode;
        if(mode==='manual'){
            state.parts=next.parts;state.contractBound=bound;state.manualPreview=null;state.manualResult=null;state.totals=next.totals;
            state.resultStatuses.manual={message:'',type:''};setManualStatus('','');renderManual();
        }else{
            state.targetSimParts=next.targetSimParts;state.targetBound=bound;state.targetResult=null;state.resultStatuses.target={message:'',type:''};
            renderTargetScopeButtons();renderTargetCurrentParts();renderTargetParts();
        }
        renderBoundControls();renderResultSummary();return true;
    }

    function importEquipmentPreset(mode){
        const select=document.querySelector(`[data-equipment-preset="${mode}"]`),preset=state.presets.find(item=>item.id===select.value);
        const status=document.querySelector(`[data-import-status="${mode}"]`);
        if(!preset){status.textContent='불러올 비밀계약 세팅을 선택하세요.';return;}
        const snapshot=preset.snapshot,source=snapshot.editorParts||snapshot.parts;
        const fallback=state.contracts.find(c=>c.english_name===snapshot.selectedContract)?.clientSuitId||state.contracts[0].clientSuitId;
        const parts=Array.from({length:6},(_,index)=>normalizePartSnapshot(source?.[index],index));
        for(const part of parts)part.setId??=fallback;
        status.textContent='';
        if(applyImportedEquipment(mode,parts,!!(snapshot.editorBound??snapshot.contractBound)))window.MorimensToast.show(`${preset.name} 불러옴`);
    }




    function getDefaultPresetName() {
        const contractName = getPresetContractName(state.editorParts);
        return `${contractName} ${formatTotalCompletion(sharedModel.simulatorCompletion(state.editorParts,state.editorBound))}%`;
    }


    function getPresetContractName(parts) {
        const ids=new Set(parts.map(part=>part.setId??state.selectedContract?.clientSuitId??0).filter(Boolean));
        if(!ids.size)return '미장착';
        if(ids.size>1)return '혼합 비밀계약';
        return state.contracts.find(contract=>contract.clientSuitId===[...ids][0])?.korean_name||'비밀계약';
    }



    function normalizePartSnapshot(part, index) {
        const base = createDefaultPart(index);
        if (!part || typeof part !== 'object') return base;
        const substats = Array.from({ length: 3 }, (_, substatIndex) => normalizeSubstat(part.substats && part.substats[substatIndex], base.substats[substatIndex]));
        let lockedCount=0;for(const substat of substats){substat.locked=part.setId!==0&&substat.locked&&lockedCount<2;if(substat.locked)lockedCount++;}
        const goals = Array.from({ length: 3 }, (_, goalIndex) => normalizeGoal(part.goals && part.goals[goalIndex], base.goals[goalIndex]));
        return {
            setId:part.setId===0||Object.values(editorDefinition.setIds).includes(part.setId)?part.setId:undefined,
            mainOption: part.mainOption==='none'?'none':MAIN_OPTIONS[index].includes(part.mainOption) ? part.mainOption : base.mainOption,
            mainLevel: clampIndex(part.mainLevel, 0, MAX_MAIN_LEVEL, base.mainLevel),
            substats,
            goals,
            lastTouched: !!part.lastTouched
        };
    }

    function normalizeSubstat(substat, fallback) {
        if (!substat || typeof substat !== 'object') return { ...fallback };
        return {
            option: substat.option==='none'?'none':optionById[substat.option] ? substat.option : fallback.option,
            level: clampIndex(substat.level, 1, 8, fallback.level),
            locked: !!optionById[substat.option]&&!!substat.locked
        };
    }

    function normalizeGoal(goal, fallback) {
        if (!goal || typeof goal !== 'object') return { ...fallback };
        return {
            option: optionById[goal.option] ? goal.option : fallback.option,
            level: clampIndex(goal.level, 1, 8, fallback.level),
            enabled: typeof goal.enabled === 'boolean' ? goal.enabled : fallback.enabled
        };
    }

    function normalizeTargetParts(targetParts) {
        const unique = Array.from(new Set((Array.isArray(targetParts) ? targetParts : [0, 1, 2, 3, 4, 5])
            .map(value => Number(value))
            .filter(value => Number.isInteger(value) && value >= 0 && value <= 5)));
        return unique.length ? unique.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5];
    }

    function applyStoredControlValues(snapshot) {
        const manualLockCostMode = snapshot.manualLockCostMode === 'quill' ? 'quill' : 'fragment';
        const manualLockInput = document.querySelector(`input[name="manual-lock-cost"][value="${manualLockCostMode}"]`);
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) {
            els.targetLockCost.value = snapshot.targetLockCostMode === 'quill' ? 'quill' : 'fragment';
        }
    }

    function clampIndex(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isInteger(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function resetSimulation() {
        document.querySelector(`[data-import-status="${state.mode}"]`)?.replaceChildren();
        const mode=state.mode,defaults=()=>Array.from({length:6},(_,index)=>({...createDefaultPart(index),setId:state.contracts[0].clientSuitId}));
        if(mode==='editor'){state.editorParts=defaults();state.editorBound=false;state.editorPart=-1;editorView=null;state.hasUnsavedPresetChanges=false;}
        if(mode==='manual'){
            state.parts=defaults();state.contractBound=false;state.selectedPart=0;
            state.manualPreview=null;state.manualResult=null;state.totals=createEmptyTotals();
            state.resultStatuses.manual={message:'',type:''};setManualStatus('','');
            document.querySelector('input[name="manual-lock-cost"][value="fragment"]').checked=true;
        }
        if(mode==='target'){
            cancelTargetSimulation();state.targetSimParts=defaults();state.targetBound=false;state.targetResult=null;
            state.targetParts=[0,1,2,3,4,5];state.targetEditorPart=0;state.targetEditorView='goals';
            state.resultStatuses.target={message:'',type:''};els.targetLockCost.value='fragment';
        }
        renderParts();renderMode();saveCurrentState();
    }

    function restoreResult(result,type){
        if(!result||result.type!==type||!Number.isFinite(result.attempts)||result.attempts<0||!result.cost||!Array.isArray(result.allParts)||result.allParts.length!==6)return null;
        const copy=structuredClone(result);
        copy.cost=Object.fromEntries(Object.keys(createEmptyTotals()).map(key=>[key,Number.isFinite(result.cost[key])&&result.cost[key]>=0?result.cost[key]:0]));
        copy.allParts=copy.allParts.map((part,index)=>{const normalized=normalizePartSnapshot(part,index);return{partIndex:index,setId:normalized.setId,mainOption:normalized.mainOption,mainLevel:normalized.mainLevel,substats:normalized.substats};});
        if(type==='manual'){
            copy.partIndex=clampIndex(copy.partIndex,0,5,0);
            copy.finalSubstats=copy.allParts[copy.partIndex].substats;
        }else{
            if(!Array.isArray(copy.partResults))return null;
            copy.partResults=copy.partResults.filter(part=>Number.isInteger(part.partIndex)&&part.partIndex>=0&&part.partIndex<6).map(part=>({...part,finalSubstats:copy.allParts[part.partIndex].substats}));
        }
        return copy;
    }

    function createDefaultPart(index) {
        return {
            mainOption: MAIN_OPTIONS[index][0],
            mainLevel: 0,
            substats: [
                { option: 'critRate', level: 1, locked: false },
                { option: 'critDamage', level: 1, locked: false },
                { option: 'domainMastery', level: 1, locked: false }
            ],
            goals: [
                { option: 'critRate', level: 4, enabled: true },
                { option: 'critDamage', level: 4, enabled: false },
                { option: 'damageAmp', level: 4, enabled: false }
            ],
            lastTouched: false
        };
    }

    function getAllPartSnapshots(previewPartIndex, previewSubstats) {
        return state.parts.map((part, index) => ({
            partIndex: index,
            setId:part.setId,
            mainOption: part.mainOption,
            mainLevel: part.mainLevel,
            substats: cloneSubstats(index === previewPartIndex && previewSubstats ? previewSubstats : part.substats)
        }));
    }

    function getAllTargetPartSnapshots() {
        return state.targetSimParts.map((part, index) => ({
            partIndex: index,
            setId:part.setId,
            mainOption: part.mainOption,
            mainLevel: part.mainLevel,
            substats: cloneSubstats(part.substats)
        }));
    }

    function getTargetResultPartSnapshots(result) {
        const resultByPart = new Map(result.partResults.map(partResult => [partResult.partIndex, partResult]));
        return (result.snapshotParts||state.targetSimParts).map((part, index) => {
            const partResult = resultByPart.get(index);
            return {
                partIndex: index,
                setId:part.setId,
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: cloneSubstats(partResult ? partResult.finalSubstats : part.substats)
            };
        });
    }

    function getRerollCost(lockedCount, lockCostMode) {
        return targetModel.covenantRerollCost(lockedCount,lockCostMode);
    }

    function getPartCompletion(part, substats = part.substats) {
        return sharedModel.simulatorCompletion([{...part,substats}],!!state.contractBound);
    }

    function getTotalCompletion() {
        return sharedModel.simulatorCompletion(state.parts,!!state.contractBound);
    }

    function formatTotalCompletion(value) {
        return formatNumber(value, 1);
    }

    function getSelectedPart() {
        return state.parts[state.selectedPart];
    }

    function getManualLockCostMode() {
        const checked = document.querySelector('input[name="manual-lock-cost"]:checked');
        return checked ? checked.value : 'fragment';
    }

    function countLocked(substats) {
        return substats.filter(substat => optionById[substat.option]&&substat.locked).length;
    }

    function createEmptyTotals() {
        return { rerolls: 0, gold: 0, seals: 0, fragments: 0, quills: 0 };
    }

    function addTotals(target, source) {
        target.gold += source.gold || 0;
        target.seals += source.seals || 0;
        target.fragments += source.fragments || 0;
        target.quills += source.quills || 0;
    }

    function addScaledTotals(target, source, multiplier) {
        target.gold += (source.gold || 0) * multiplier;
        target.seals += (source.seals || 0) * multiplier;
        target.fragments += (source.fragments || 0) * multiplier;
        target.quills += (source.quills || 0) * multiplier;
    }

    function cloneSubstats(substats) {
        return substats.map(substat => ({ ...substat }));
    }

    function getOptionName(optionId) {
        if(optionId==='none')return '미설정';
        return optionById[optionId] ? optionById[optionId].name : optionId;
    }

    function getContractPartName(partIndex,parts=state.parts) {
        const contractName = state.contracts.find(c=>c.clientSuitId===(parts[partIndex].setId??state.selectedContract?.clientSuitId))?.korean_name||'미장착';
        return `${contractName} ${ROMANS[partIndex]}`;
    }

    function getSubstatText(substat) {
        const option = optionById[substat.option];
        if(!option)return '없음';
        return `${option.name} ${formatNumber(option.step * substat.level, 2)}${option.unit} (Lv ${substat.level})`;
    }

    function renderStatLine(substat) {
        const optionName = substat.option==='none'?'':getOptionName(substat.option);
        return `<div class="stat-line"><span class="stat-name">${renderAttributeIcon(substat.option,true)}<span>${escapeHtml(optionName)}</span></span><span class="stat-value">${escapeHtml(getSubstatText(substat).replace(`${optionName} `, ''))}</span></div>`;
    }

    function renderAttributeIcon(optionId,decorative=false){
        const icon={critRate:'008',critDamage:'007',domainMastery:'002',damageAmp:'004',madnessRegen:'003',silverCharge:'005',blackSealDrop:'001',deathResist:'006'}[optionId];
        return icon?`<img class="covenant-attribute-icon" src="images/keyword-icons/original/ui_battle_white_buff_${icon}.png" width="24" height="24" alt="${decorative?'':escapeHtml(getOptionName(optionId))}" title="${escapeHtml(getOptionName(optionId))}">`:'<span>—</span>';
    }

    function renderCompactStatLine(substat) {
        const optionName = substat.option==='none'?'':getOptionName(substat.option);
        return `<div class="compact-stat-line"><span class="stat-name">${renderAttributeIcon(substat.option,true)}<span>${escapeHtml(optionName)}</span></span><span class="stat-value">${escapeHtml(getSubstatText(substat).replace(`${optionName} `, ''))}</span></div>`;
    }

    function formatCost(cost) {
        const parts = [`금권 ${formatInteger(cost.gold)}`, `천면 인장 ${formatInteger(cost.seals)}`];
        if (cost.fragments) parts.push(`잔본 ${formatInteger(cost.fragments)}`);
        if (cost.quills) parts.push(`깃펜 ${formatInteger(cost.quills)}`);
        return parts.join(' / ');
    }

    function formatInteger(value) {
        return Math.round(value).toLocaleString('ko-KR');
    }

    function formatNumber(value, digits) {
        if (Number.isInteger(value)) return value.toLocaleString('ko-KR');
        return Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
    }

    function formatStatValue(value, unit) {
        return `${formatNumber(value, 2)}${unit}`;
    }

    function range(start, end) {
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function toCamel(id) {
        return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
})();
