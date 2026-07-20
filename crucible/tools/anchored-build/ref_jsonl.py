import json, glob, collections
amt = collections.defaultdict(float); it = collections.defaultdict(int); tags = collections.Counter()
for f in sorted(glob.glob('records_*.jsonl')):
    for line in open(f):
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        amt[r['user']] += r['amount']; it[r['user']] += r['items']
        for t in r.get('tags', []): tags[t] += 1
users = sorted(amt, key=lambda u: (-amt[u], u))[:5]
out = {
    "top_5_users_by_amount": {u: {"total_amount": round(amt[u], 2), "total_items": it[u]} for u in users},
    "top_5_tags_by_count": {t: {"count": c} for t, c in tags.most_common(5)},
}
json.dump(out, open('aggregates.json', 'w'), indent=2)
