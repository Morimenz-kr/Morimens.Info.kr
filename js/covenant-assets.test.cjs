const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

test('모든 계약 세트의 6부위 이미지는 원본 Item.Icon 매핑과 검증 해시를 가진다', () => {
    const root = path.join(__dirname, '..');
    const parts = JSON.parse(fs.readFileSync(path.join(root, 'data/covenant_parts.json')));
    const proof = JSON.parse(fs.readFileSync(path.join(root, 'images/covenant-parts/sources.json')));
    const seen = new Set();
    for (const suit of parts) {
        assert.equal(suit.parts.length, 6);
        for (const part of suit.parts) {
            assert.match(part.imagePath, /^images\/covenant-parts\/\d+\/[iv]+\.webp$/);
            assert.ok(!seen.has(part.imagePath)); seen.add(part.imagePath);
            const record = proof.records.find(r => r.imagePath === part.imagePath);
            assert.equal(record?.suitId, suit.suitId);
            assert.equal(record.clientItemId, part.clientItemId);
            assert.equal(record.sourceIcon, part.sourceIcon);
            const bytes = fs.readFileSync(path.join(root, part.imagePath));
            assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
            assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
        }
    }
    assert.equal(proof.records.length, seen.size);
});
