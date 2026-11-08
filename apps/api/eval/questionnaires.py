import csv,json,sys,re,statistics as st
main,follow,out=sys.argv[1:4]
num=lambda x: int(re.match(r'\s*(\d+)',x).group(1)) if x and re.match(r'\s*(\d+)',x) else None
R=list(csv.DictReader(open(main))); F=list(csv.DictReader(open(follow)))
H=list(R[0].keys()) if R else []
def col(pat): return [h for h in H if re.search(pat,h)]
res={'n':len(R),'nFollow':len(F)}
# demographics
for key in ['Age range','Gender','Nationality','How would you rate your own technological literacy?','How often do you use mobile apps to meet or connect with new people?','What are you mainly looking for on this kind of app?','Which phone are you using?']:
    c={}
    for r in R: c[r[key]]=c.get(r[key],0)+1
    res.setdefault('demo',{})[key]=c
# tasks
tasks={}
for t in range(1,8):
    done=[r[f'Task {t}: did you manage to do it?'] for r in R]
    ease=[num(r[f'Task {t}: overall, this task was']) for r in R]; ease=[e for e in ease if e is not None]
    tasks[t]={'yes':done.count('Yes'),'partly':done.count('Partly'),'no':done.count('No'),'other':len(done)-done.count('Yes')-done.count('Partly')-done.count('No'),
              'easeMean':st.mean(ease) if ease else None,'easeSd':st.pstdev(ease) if len(ease)>1 else 0,'easeN':len(ease),
              'comments':[r[f'Task {t}: was anything confusing, or different from what you expected? (optional)'] for r in R if r[f'Task {t}: was anything confusing, or different from what you expected? (optional)'].strip()]}
    open_q=[h for h in H if h.startswith(f'Task {t}:') and 'did you manage' not in h and 'overall' not in h and 'confusing' not in h]
    tasks[t]['openQ']=open_q[0] if open_q else None
    tasks[t]['open']=[r[open_q[0]] for r in R] if open_q else []
res['tasks']=tasks
# SUS
sus_cols=col(r'^Your experience with Haven \[')
sus=[]
for r in R:
    v=[num(r[c]) for c in sus_cols]
    if None in v: continue
    s=sum((x-1) if i%2==0 else (5-x) for i,x in enumerate(v))*2.5; sus.append(s)
res['sus']={'scores':sus,'mean':st.mean(sus) if sus else None,'sd':st.pstdev(sus) if len(sus)>1 else 0,'median':st.median(sus) if sus else None,
            'items':{c.split('[')[1][:-1]:st.mean([num(r[c]) for r in R]) for c in sus_cols}}
# UEQ-S
ueq_cols=[h for h in H if '–' in h and not h.startswith('Your')]
ueq={}
for c in ueq_cols:
    v=[num(r[c]) for r in R if num(r[c]) is not None]; ueq[c]={'mean':st.mean(v)-4 if v else None,'sd':st.pstdev(v) if len(v)>1 else 0}
prag=[st.mean([num(r[c])-4 for c in ueq_cols[:4]]) for r in R]; hed=[st.mean([num(r[c])-4 for c in ueq_cols[4:8]]) for r in R]
res['ueq']={'items':ueq,'pragmatic':st.mean(prag) if prag else None,'pragmaticSd':st.pstdev(prag) if len(prag)>1 else 0,'hedonic':st.mean(hed) if hed else None,'hedonicSd':st.pstdev(hed) if len(hed)>1 else 0,
            'overall':st.mean([(p+h)/2 for p,h in zip(prag,hed)]) if prag else None}
# perception
pc=col(r'^Recommendations and matches \[')
def lik(vals):
    v=[x for x in vals if x is not None]
    return {'mean':st.mean(v) if v else None,'sd':st.pstdev(v) if len(v)>1 else 0,'agree':sum(1 for x in v if x>=4),'n':len(v),'dist':{k:v.count(k) for k in range(1,6)}}
res['perception']={c.split('[')[1][:-1]:lik([num(r[c]) for r in R]) for c in pc}
res['keepUsing']=lik([num(r['How likely are you to keep using an app like this?']) for r in R])
res['recommend']=lik([num(r['How likely are you to recommend it to a friend?']) for r in R])
res['open']={k:[r[k] for r in R if r[k].strip()] for k in ['What did you like most?','What did you find most difficult or frustrating?','What would you add or change?']}
# follow-up
FH=list(F[0].keys())
fl={}
for h in FH[2:]:
    vals=[r[h] for r in F]
    nums=[num(v) for v in vals]
    if sum(x is not None for x in nums)>=len(vals)*0.6 and not h.startswith('On which'):
        fl[h]=lik(nums)
    else:
        c={}
        for v in vals: c[v]=c.get(v,0)+1
        fl[h]=c
res['follow']=fl
json.dump(res,open(out,'w'),indent=1,ensure_ascii=False)
print(json.dumps({k:res[k] for k in ['n','nFollow','sus','ueq']},ensure_ascii=False)[:1500])
