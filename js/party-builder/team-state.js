const DEFAULT_ROMAN_NUMERALS = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);

function emptyWheelSlots() {
    return Array.from({ length: 4 }, () => [null, null]);
}

export function cloneTeam(team) {
    return {
        ...team,
        chars: Array.isArray(team?.chars) ? team.chars.slice(0, 4) : [null, null, null, null],
        wheels: Array.from({ length: 4 }, (_, index) => {
            const slots = Array.isArray(team?.wheels?.[index]) ? team.wheels[index] : [];
            return [slots[0] ?? null, slots[1] ?? null];
        })
    };
}

export function createPartyStateFactory(options = {}) {
    const maxTeams = Number.isInteger(options.maxTeams) && options.maxTeams > 0 ? options.maxTeams : 10;
    const romanNumerals = Array.isArray(options.romanNumerals) && options.romanNumerals.length >= maxTeams
        ? [...options.romanNumerals]
        : [...DEFAULT_ROMAN_NUMERALS];

    function createEmptyTeam(index) {
        return {
            name: `TEAM ${romanNumerals[index] || index + 1}`,
            chars: [null, null, null, null],
            wheels: emptyWheelSlots(),
            key: null,
            supportIdx: -1
        };
    }

    function createEmptyPage(name) {
        return {
            pageName: name,
            teams: Array.from({ length: maxTeams }, (_, index) => createEmptyTeam(index))
        };
    }

    return Object.freeze({ createEmptyTeam, createEmptyPage });
}

export function moveTeam(teams, fromIndex, toIndex, currentTeamIndex) {
    const valid = Array.isArray(teams)
        && Number.isInteger(fromIndex)
        && Number.isInteger(toIndex)
        && fromIndex >= 0
        && toIndex >= 0
        && fromIndex < teams.length
        && toIndex < teams.length
        && fromIndex !== toIndex;
    if (!valid) return Object.freeze({ teams, currentTeamIndex, changed: false });

    const reordered = [...teams];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    let nextCurrentTeamIndex = currentTeamIndex;
    if (currentTeamIndex === fromIndex) {
        nextCurrentTeamIndex = toIndex;
    } else if (fromIndex < currentTeamIndex && toIndex >= currentTeamIndex) {
        nextCurrentTeamIndex -= 1;
    } else if (fromIndex > currentTeamIndex && toIndex <= currentTeamIndex) {
        nextCurrentTeamIndex += 1;
    }

    return Object.freeze({ teams: reordered, currentTeamIndex: nextCurrentTeamIndex, changed: true });
}

export function resolvePageIndexAfterDeletion(currentPageIndex, deletedPageIndex, remainingPageCount) {
    if (!Number.isInteger(currentPageIndex)
        || !Number.isInteger(deletedPageIndex)
        || !Number.isInteger(remainingPageCount)
        || remainingPageCount <= 0) {
        return 0;
    }

    const adjustedIndex = deletedPageIndex <= currentPageIndex
        ? currentPageIndex - 1
        : currentPageIndex;
    return Math.max(0, Math.min(adjustedIndex, remainingPageCount - 1));
}

export function resetTeam(team) {
    return {
        ...team,
        chars: [null, null, null, null],
        wheels: emptyWheelSlots(),
        key: null,
        supportIdx: -1
    };
}

export function applyCharacterSelection(team, selectedCharacterIds) {
    const source = cloneTeam(team);
    const wheelCache = new Map();
    source.chars.forEach((characterId, index) => {
        if (characterId) wheelCache.set(characterId, [...source.wheels[index]]);
    });

    const keepsSupport = source.supportIdx === 3 && Boolean(source.chars[3]);
    const nextChars = [null, null, null, null];
    const selectionLimit = keepsSupport ? 3 : 4;
    (Array.isArray(selectedCharacterIds) ? selectedCharacterIds : [])
        .slice(0, selectionLimit)
        .forEach((characterId, index) => {
            nextChars[index] = characterId;
        });

    if (keepsSupport) nextChars[3] = source.chars[3];

    const nextWheels = nextChars.map(characterId => (
        characterId && wheelCache.has(characterId)
            ? [...wheelCache.get(characterId)]
            : [null, null]
    ));

    return { ...source, chars: nextChars, wheels: nextWheels };
}

export function findCharacterInPage(page, characterId, preferredTeamIndex) {
    if (!Array.isArray(page?.teams)) return null;
    const teamOrder = [];
    if (preferredTeamIndex >= 0 && preferredTeamIndex < page.teams.length) teamOrder.push(preferredTeamIndex);
    page.teams.forEach((_, index) => {
        if (index !== preferredTeamIndex) teamOrder.push(index);
    });

    for (const teamIndex of teamOrder) {
        const team = page.teams[teamIndex];
        for (let slotIndex = 0; slotIndex < team.chars.length; slotIndex += 1) {
            if (team.chars[slotIndex] === characterId) {
                return Object.freeze({
                    teamIndex,
                    slotIndex,
                    wheels: Array.isArray(team.wheels?.[slotIndex])
                        ? [...team.wheels[slotIndex]]
                        : [null, null]
                });
            }
        }
    }
    return null;
}

export function applySupport(page, characterId, targetTeamIndex) {
    if (!Array.isArray(page?.teams) || !page.teams[targetTeamIndex] || !characterId) return page;
    const source = findCharacterInPage(page, characterId, targetTeamIndex);
    const supportWheels = source ? [...source.wheels] : [null, null];
    const nextTeams = page.teams.map(cloneTeam);

    nextTeams.forEach(team => {
        if (team.supportIdx < 0 || team.supportIdx >= team.chars.length) {
            team.supportIdx = -1;
            return;
        }
        team.chars[team.supportIdx] = null;
        team.wheels[team.supportIdx] = [null, null];
        team.supportIdx = -1;
    });

    if (source) {
        nextTeams[source.teamIndex].chars[source.slotIndex] = null;
        nextTeams[source.teamIndex].wheels[source.slotIndex] = [null, null];
    }

    const targetTeam = nextTeams[targetTeamIndex];
    targetTeam.chars[3] = characterId;
    targetTeam.wheels[3] = supportWheels;
    targetTeam.supportIdx = 3;
    return { ...page, teams: nextTeams };
}

export function removeSupportFromPage(page) {
    if (!Array.isArray(page?.teams)) return page;
    return {
        ...page,
        teams: page.teams.map(team => {
            const nextTeam = cloneTeam(team);
            if (nextTeam.supportIdx >= 0 && nextTeam.supportIdx < nextTeam.chars.length) {
                nextTeam.chars[nextTeam.supportIdx] = null;
                nextTeam.wheels[nextTeam.supportIdx] = [null, null];
            }
            nextTeam.supportIdx = -1;
            return nextTeam;
        })
    };
}

export function replaceTeamComposition(team, composition) {
    return {
        ...team,
        chars: [...composition.chars],
        wheels: composition.wheels.map(slots => [...slots]),
        key: composition.key,
        supportIdx: composition.supportIdx
    };
}
