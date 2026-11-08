import json,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.edgecolor':'#8a8984','axes.labelcolor':'#52514e','xtick.color':'#52514e','ytick.color':'#52514e','axes.spines.top':False,'axes.spines.right':False,'figure.dpi':200})
B,O,A,G='#2a78d6','#eb6834','#1baf7a','#a8a7a1'
T='#0b0b0b'
S={p:json.load(open(f'simc-{p}.json')) for p in '01'}
names={'0':'Friendship pool','1':'Dating pool'}
# Fig A: offline P@4 and NDCG@10
order=['Full system','One-sided score','Interests only','Popularity','Random']
fig,axs=plt.subplots(1,2,figsize=(8,3.2),sharey=True)
for ax,p in zip(axs,'01'):
    o=S[p]['offline'][p]
    x=range(len(order)); w=0.38
    v1=[o[k]['precision'] for k in order]; v2=[o[k]['ndcg10'] for k in order]
    ax.bar([i-w/2-0.01 for i in x],v1,w,color=B,label='Precision@4')
    ax.bar([i+w/2+0.01 for i in x],v2,w,color=O,label='NDCG@10')
    for i,(a,b) in enumerate(zip(v1,v2)):
        ax.text(i-w/2-0.01,a+0.01,f'{a:.2f}',ha='center',va='bottom',fontsize=7,color=T); ax.text(i+w/2+0.01,b+0.01,f'{b:.2f}',ha='center',va='bottom',fontsize=7,color=T)
    ax.set_xticks(list(x)); ax.set_xticklabels(['Full\nsystem','One-sided','Interests\nonly','Popularity','Random'],fontsize=8)
    ax.set_title(names[p],fontsize=10,color=T); ax.set_ylim(0,0.75); ax.yaxis.grid(True,color='#e6e5e0',lw=0.6); ax.set_axisbelow(True)
axs[0].legend(frameon=False,fontsize=8,loc='upper right')
fig.tight_layout(); fig.savefig('fig/offline.png'); plt.close()
# Fig B: mu sweep trade-off
fig,axs=plt.subplots(1,2,figsize=(8,3.2))
for ax,p,c in zip(axs,'01',[B,O]):
    m=S[p]['muSweep'][p]; mus=sorted(m,key=float)
    gx=[m[k]['giniExposure'] for k in mus]; my=[m[k]['matchesPerUser'] for k in mus]
    ax.plot(gx,my,'-',color=c,lw=2); ax.plot(gx,my,'o',color=c,ms=6,mec='white',mew=1.5)
    for i,(k,a,b) in enumerate(zip(mus,gx,my)): ax.annotate(f'μ = {float(k):g}',(a,b),textcoords='offset points',xytext=(0,8 if i%2==0 else -14),ha='center',fontsize=7,color=T)
    ax.set_xlabel('Gini coefficient of exposure'); ax.set_ylabel('Matches per user in 14 days')
    lo=min(my); hi=max(my); ax.set_ylim(lo-(hi-lo)*1.5-0.5,hi+(hi-lo)*1.5+0.5)
    ax.set_title(names[p],fontsize=10,color=T); ax.invert_xaxis(); ax.grid(True,color='#e6e5e0',lw=0.6); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig('fig/mu.png'); plt.close()
# Fig C: weight sensitivity
sens=json.load(open('sens-dev.json')); d={r['variant']:r for r in sens}
comp=[('bio','Bio'),('interest','Interests'),('geo','Proximity'),('pref','Partner preferences')]
fig,ax=plt.subplots(figsize=(8,3.0))
labs=[('x0.5','Weight × 0.5',B),('x1.5','Weight × 1.5',O),('= 0','Weight set to 0',A)]
w=0.26
for j,(suf,lab,c) in enumerate(labs):
    vals=[d[f'{k} {suf}']['o4'] for k,_ in comp]
    xs=[i+(j-1)*(w+0.02) for i in range(len(comp))]
    ax.bar(xs,vals,w,color=c,label=lab)
    for xx,v in zip(xs,vals): ax.text(xx,v+0.01,f'{v:.2f}',ha='center',va='bottom',fontsize=7,color=T)
rnd=[r['o4'] for r in sens if r['variant'].startswith('random')]
ax.axhline(sum(rnd)/len(rnd),color=G,lw=1.5,ls='--'); ax.text(-0.5,sum(rnd)/len(rnd)+0.015,'random weights (mean)',ha='left',fontsize=7,color='#52514e')
ax.set_xticks(range(len(comp))); ax.set_xticklabels([c for _,c in comp]); ax.set_ylabel('Share of the batch of four kept'); ax.set_ylim(0,1)
ax.legend(frameon=False,fontsize=8,ncol=3,loc='upper left',bbox_to_anchor=(0,1.12)); ax.yaxis.grid(True,color='#e6e5e0',lw=0.6); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig('fig/sens.png'); plt.close()
# Fig D: eta sweep
fig,axs=plt.subplots(1,2,figsize=(8,3.0),sharey=True)
for ax,p in zip(axs,'01'):
    ns=S[p]['noiseSweep']; xs=sorted(ns,key=float)
    for k,c,l in [('Full system',B,'Full system'),('Interests only',O,'Interests only'),('Random',G,'Random')]:
        ys=[ns[x][p][k]['precision'] for x in xs]
        ax.plot([float(x) for x in xs],ys,'-',color=c,lw=2,label=l); ax.plot([float(x) for x in xs],ys,'o',color=c,ms=6,mec='white',mew=1.5)
    ax.set_xlabel('Share of noise in hidden preferences, η'); ax.set_title(names[p],fontsize=10,color=T); ax.grid(True,color='#e6e5e0',lw=0.6); ax.set_axisbelow(True); ax.set_xticks([0,0.25,0.5,0.75,1])
axs[0].set_ylabel('Precision@4'); axs[0].legend(frameon=False,fontsize=8)
fig.tight_layout(); fig.savefig('fig/eta.png'); plt.close()
# Fig E: perception items session 1 vs day 3
u=json.load(open('u/u.json'))
items=[('The people recommended to me felt relevant.','Relevant'),('I understood why a given profile was recommended to me.','Understood why'),('I trust the way the app decides who to show me.','Trust'),('I felt I would be given a fair chance of being seen by other users.','Fair chance'),('The number of recommendations shown at a time felt right (not too many, not too few).','Batch size right')]
s1=[u['perception'][k]['mean'] for k,_ in items]
f=u['follow']; s3=[f['Thinking about all three days ['+k+']']['mean'] for k,_ in items]
fig,ax=plt.subplots(figsize=(8,3.0)); w=0.38
xs=range(len(items))
ax.bar([i-w/2-0.01 for i in xs],s1,w,color=B,label='Day 1 session'); ax.bar([i+w/2+0.01 for i in xs],s3,w,color=O,label='After three days')
for i,(a,b) in enumerate(zip(s1,s3)): ax.text(i-w/2-0.01,a+0.05,f'{a:.2f}',ha='center',fontsize=7,color=T); ax.text(i+w/2+0.01,b+0.05,f'{b:.2f}',ha='center',fontsize=7,color=T)
ax.set_xticks(list(xs)); ax.set_xticklabels([l for _,l in items],fontsize=8); ax.set_ylim(1,5.4); ax.set_yticks([1,2,3,4,5]); ax.set_ylabel('Mean agreement (1 to 5)')
ax.legend(frameon=False,fontsize=8,ncol=2,loc='upper left',bbox_to_anchor=(0,1.12)); ax.yaxis.grid(True,color='#e6e5e0',lw=0.6); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig('fig/percep.png'); plt.close()
print('ok')
