const allSubs = [
  { id: '1a', profile_id: '123', is_manual: false },
  { id: 'manual-123', profile_name: 'test', is_manual: true }
];
const subs = [{profile_id: '123'}];
const formalProfileIds = new Set(subs ? subs.map(s => s.profile_id).filter(id => id) : []);
let uniqueSubs = allSubs.filter(s => {
    if (s.is_manual) {
        const rawProfileId = s.id.replace('manual-', '');
        if (formalProfileIds.has(rawProfileId)) return false;
    }
    return true;
});
console.log(uniqueSubs);
