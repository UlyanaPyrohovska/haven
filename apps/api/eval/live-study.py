import json,collections as C,statistics as st,datetime as dt
d=json.load(open('dev.json'))
meta={m['id']:m for m in d['meta']}
syn={i for i,m in meta.items() if m['isSynthetic']}
P=sorted(i for i,m in meta.items() if not m['isSynthetic'] and m['createdAt']>='2026-10-30')
print('participants',P,[meta[i]['lookingFor'] for i in P])
Ps=set(P)
def gini(v):
    v=sorted(v);n=len(v);t=sum(v)
    return 0 if not t else 2*sum((i+1)*x for i,x in enumerate(v))/(n*t)-(n+1)/n
E_=d['exposures']; R=d['recommendations']; I=d['interactions']
# batches shown to participants
ex_p=[e for e in E_ if e['viewer'] in Ps]
days=C.defaultdict(set)
for e in ex_p: days[e['viewer']].add(e['shownAt'][:10])
print('exposures to participants',len(ex_p),'per user',{u:len([e for e in ex_p if e['viewer']==u]) for u in P})
print('days with batch',{u:len(days[u]) for u in P})
# candidates shown to participants: synthetic vs real
cand=C.Counter(e['candidate'] for e in ex_p)
print('distinct cands',len(cand),'real cands share',sum(v for k,v in cand.items() if k not in syn)/max(1,len(ex_p)))
# participant decisions
dec=[]
for i in I:
    for me,other,dm,do,role in [(i['a'],i['b'],i['decA'],i['decB'],'a'),(i['b'],i['a'],i['decB'],i['decA'],'b')]:
        if me in Ps and dm is not None: dec.append((me,other,dm,do,role,i['match'],i['createdAt']))
print('participant decisions',len(dec),'likes',sum(1 for x in dec if x[2]==1),'passes',sum(1 for x in dec if x[2]==0))
likes=[x for x in dec if x[2]==1]
print('likes to synthetic',sum(1 for x in likes if x[1] in syn),'answered',sum(1 for x in likes if x[3] is not None),'liked back',sum(1 for x in likes if x[3]==1))
m=[i for i in I if i['match'] and (i['a'] in Ps or i['b'] in Ps)]
print('matches involving participants',len(m),'real-real',sum(1 for i in m if i['a'] not in syn and i['b'] not in syn))
pm=C.Counter();[pm.update([x]) for i in m for x in (i['a'],i['b']) if x in Ps]
print('matches per participant',[pm.get(u,0) for u in P])
# inbound likes from agents to participants
inb=[x for x in dec if x[4]=='b' and x[1] in syn]
print('decisions on agent likes',len(inb))
# messages
inter={i['id']:i for i in I}
msg=[x for x in d['messages'] if x['sender'] in Ps]
print('messages by participants',len(msg),'senders',len({x['sender'] for x in msg}),'threads',len({x['interaction'] for x in msg}))
print('messages total',len(d['messages']))
# mood and answers
print('moods',C.Counter(x['profile'] for x in d['moods'] if x['profile'] in Ps))
print('answers',C.Counter(x['profile'] for x in d['answers'] if x['profile'] in Ps))
print('crossings',[(c['a'],c['b'],c['count']) for c in d['crossings'] if c['a'] in Ps or c['b'] in Ps])
# live simulation exposures Gini (agent batches) Oct30-Nov7
ag=[e for e in E_ if e['viewer'] in syn]
cnt=C.Counter(e['candidate'] for e in ag)
for lf in (0,1):
    mem=[i for i in syn if meta[i]['lookingFor']==lf]
    v=[cnt.get(i,0) for i in mem]
    print('live agents pool',lf,'impr',sum(v),'gini',round(gini(v),3),'coverage',round(sum(1 for x in v if x)/len(v),3))
# live tick matches
live=[i for i in I if i['createdAt']>='2026-10-30']
print('live interactions',len(live),'matches',sum(i['match'] for i in live))
