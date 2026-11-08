import json,glob,statistics as st,sys,os
E='.'  # run in results/
def runs(p):
    fs=[f'{E}/simc-{p}.json']+sorted(glob.glob(f'{E}/seeds/sim-s*-{p}.json'))
    return [json.load(open(f)) for f in fs if os.path.exists(f)]
ms=lambda xs:(st.mean(xs),st.stdev(xs) if len(xs)>1 else 0)
out={}
for p in '01':
    R=runs(p); o={'n':len(R),'offline':{},'sim':{},'mu':{},'pairs':{}}
    for v in R[0]['offline'][p]:
        if v=='baseRate': continue
        o['offline'][v]={k:ms([r['offline'][p][v][k] for r in R]) for k in ['precision','hit','mrr','ndcg10']}
    for v in R[0]['simulation'][p]:
        o['sim'][v]={k:ms([r['simulation'][p][v][k] for r in R]) for k in ['matchesPerUser','giniExposure','coverage','top10Share']}
        full=[r['simulation'][p]['Full system']['matchesPerUser'] for r in R]
        x=[r['simulation'][p][v]['matchesPerUser'] for r in R]
        diffs=[(a-b)/b*100 for a,b in zip(x,full)]
        o['pairs'][v]=(ms(diffs),sum(d>0 for d in diffs),len(diffs))
    for m in R[0]['muSweep'][p]:
        o['mu'][m]={k:ms([r['muSweep'][p][m][k] for r in R]) for k in ['matchesPerUser','giniExposure']}
    out[p]=o
json.dump(out,open(f'{E}/seeds/agg.json','w'),indent=1)
for p in '01':
    o=out[p]; print('POOL',p,'runs',o['n'])
    for v,d in o['sim'].items():
        (pm,ps),pos,n=o['pairs'][v]
        print(f"  {v:28s} {d['matchesPerUser'][0]:6.2f}±{d['matchesPerUser'][1]:.2f}  G {d['giniExposure'][0]:.3f}±{d['giniExposure'][1]:.3f} cov {d['coverage'][0]:.2f}  vsFull {pm:+.1f}%±{ps:.1f} higher in {pos}/{n}")
    for v,d in o['offline'].items(): print(f"  OFF {v:24s} P {d['precision'][0]:.3f}±{d['precision'][1]:.3f} ndcg {d['ndcg10'][0]:.3f}±{d['ndcg10'][1]:.3f}")
    for m,d in sorted(o['mu'].items(),key=lambda x:float(x[0])): print(f"  mu {m:5s} {d['matchesPerUser'][0]:.2f}±{d['matchesPerUser'][1]:.2f} G {d['giniExposure'][0]:.3f}±{d['giniExposure'][1]:.3f}")
