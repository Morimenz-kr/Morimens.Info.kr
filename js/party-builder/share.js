/** Pure serialization boundary for Party Builder clipboard payloads. */

export function createTeamSharePayload(team) {
    return {
        chars: Array.isArray(team?.chars) ? [...team.chars] : [],
        wheels: Array.isArray(team?.wheels)
            ? team.wheels.map(slots => Array.isArray(slots) ? [...slots] : [])
            : [],
        key: team?.key ?? null,
        supportIdx: team?.supportIdx
    };
}

export function serializeTeamShare(team) {
    return JSON.stringify(createTeamSharePayload(team));
}

export function parseAndSanitizeTeamShare(text, options) {
    const { validator, teamName, teamIndex } = options || {};
    if (!validator?.isClipboardTeamPayload || !validator?.sanitizeTeam) {
        throw new TypeError('A Party Builder validator is required.');
    }
    if (typeof text !== 'string' || !text.trim()) throw new TypeError('Team share text is empty.');

    let payload;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        throw new TypeError('Team share text is not valid JSON.', { cause: error });
    }
    if (!validator.isClipboardTeamPayload(payload)) throw new TypeError('Invalid Party Builder team payload.');

    return validator.sanitizeTeam({ ...payload, name: teamName }, teamIndex);
}
