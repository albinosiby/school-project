import json,re
from PIL import Image
from pathlib import Path
base=Path(__file__).resolve().parents[3]
extra=json.load(open(base/'website/design/driver/view_properties.json'));coords=json.load(open(base/'website/design/driver/coordinates.json'));assets={x['id'] for x in json.load(open(base/'website/design/driver/asset_nodes.json'))}
out=base/'mobile app/driver/assets/views';out.mkdir(parents=True,exist_ok=True)
features={
 'auth':[7566,7629,7759,7892], 'crew':[15003,15282,15553],
 'transport':[5271,5638,6027,6416,9783,10127,10392,10742,14244,14506],
 'operations':[8132,8359,8483,8717,11153,11370,11710,11926,12168,12354,12538,12802,12995,13069,13983,14717],
 'account':[6922,7347,8829,8924,9182,9379,9484,9679,13368,13666,330,729,788,1058],
 'attendant':[4,1289,1433,1720,2296,2707,2980,3322,3631,3868,4193,4589,4772], 'learning':[475,5017]}
lookup={v:k for k,vs in features.items() for v in vs}
# Resolve UI intent against named destinations, keeping the source export outside widgets.
links=[
 (r'^get started$',7629),(r'^register$|new driver',7892),
 (r'pre.?trip checklist|pre.?trip inspection',9783),(r'student manifest|view stop manifest',10127),
 (r'^vehicle$|^vehicle details$|vehicle inspection',14717),(r'view service schedule|^service schedule',13069),
 (r'report (?:a )?vehicle fault|^report fault',13983),(r'^trip history|view all trips',10392),
 (r'view history|view details',10742),(r'^apply leave',8132),(r'^leave history',8483),
 (r'^lost.{0,4}found',11153),(r'^returned',11370),(r'report found item|^log new item',11926),
 (r'^message office',12168),(r'^fuel log',12538),(r'^transport notices',12802),
 (r'^edit profile',8924),(r'^settings',9182),(r'show digital pass|digital crew id|^view pass',9484),
 (r'qr code',9679),(r'^score analysis',13368),(r'view all.*payslip|^payslips',13666),
 (r'^seat.{0,4}count',2296),(r'^care flags|student care notes',1289),
 (r'^guardian handover',1433),(r'^incident log|^incident report',3322),
 (r'^extra child handling',2707),(r'^quick messages',3631),(r'^training.{0,4}sops|^safety refresher',5017),
 (r'^student scan log|^my scan',3868),(r'^monthly duty roster|^my duties',4193),
 (r'request shift swap',4589),(r'resume module|^module detail',475),
 (r'view stop.by.stop',1720),(r'^start morning duty',1720),
 (r'change driver|^change$',8359),(r'change.*photo|change profile.*image',9379),
 (r'view(?: \d+)? boarded',14506),(r'hold to end trip|end active trip|^end trip',14244),
 (r'^start.*trip',6416),(r'^afternoon drop$',6027),(r'^morning pickup$',5638),
 (r'^home$',5271),(r'^trips$',5638),(r'^live$',6416),(r'^profile$',6922),
 (r'^students$',4772),(r'^stops$',1720),(r'^duties$',4193),
]
route_names={}
for line in (base/'website/design/driver/frames.tsv').read_text().splitlines()[1:]:
 role,fullid,title=line.split('\t');i=int(fullid.split(':')[1]);route_names[i]=(role,title)
def texts(n):
 if 'text'in n:return n['text'].get('characters','')
 return ' '.join(texts(c)for c in n.get('children',[]))
def clean(s):return re.sub(r'\s+',' ',s).strip()
def checkbox_label(n):
 def small_input(x):
  return (x['name'].startswith('Input') and x.get('w',999)<=40 and x.get('h',999)<=40) or any(small_input(c)for c in x.get('children',[]))
 return n['name'].startswith('Label') and (small_input(n) or 'checklist item' in n['name'].lower())
def intent(n,screen):
 label=clean(texts(n));name=n['name'].lower()
 if not label and 'go back' in name:return 'route:'+('330'if screen<5271 else'7347') if screen in [4,5271,5638,6027,6416,6922,4772,1720,4193] else'back'
 if not label and 'download log'in name:return 'route:'+('330'if screen<5271 else'7347')
 if not label and 'button'in name and 'download'in name:return 'tap:Download document'
 if not label and 'button'in name and 'share'in name:return 'tap:Share pass'
 if re.search(r'lead driver',label,re.I)and screen in [15003,15282]:return 'tap:Lead Driver'
 if re.search(r'bus attendant',label,re.I)and screen in [15003,15282]:return 'tap:Bus Attendant'
 context_links={
  6922:[(r'^show gate pass','9484'),(r'^view all','13666'),(r'^sign out$','logout')],
  5271:[(r'^vehicle details','14717')],
  9484:[(r'^digital verification','9679')],
  7347:[(r'^pre.trip inspection cleared$','8829'),(r'^route 4b diversion notice$','8829')],
  330:[(r'^urgent route bulletin|^route 4b diversion','729')],
  12802:[(r'^severe rain|^sector 14 market stop|^rain protocol|^speed governor . telematics audit','12995')],
  11153:[(r'^blue wildcraft|^milton stainless','12354')],
  11370:[(r'^milton stainless|^view handover receipt|^view custody transfer','11710')],
  10127:[(r'^view all boarded|^view boarded','14506')],
  10742:[(r'^boarded|^view boarded','14506')],
  4193:[(r'^safety sweep|^sweep pdf','2980')],
  4:[(r'^start morning duty','1720')],
  8483:[(r'^reapply$','8132')],
  14244:[(r'^found an unclaimed item','11926')],
  4193:[(r'^safety sweep|^sweep pdf','2980'),(r'^resume handover','1433')],
  788:[(r'^student scan log','3868'),(r'^monthly duty roster','4193'),(r'^safety refresher|^training','5017')],
 }
 for pat,target in context_links.get(screen,[]):
  if re.search(pat,label,re.I):return 'tap:Sign Out'if target=='logout'else'route:'+target
 if screen==7892 and label.lower()=='sign in':return 'route:7629'
 if 'download' in name and label.lower() in ['pdf','view']:return 'tap:Download document'
 if 'photo' in name and 'button' in name:return 'tap:Camera'if screen==9379 else'route:9379'
 if 'notifications' in name and len(label)<3:return 'route:'+('330' if screen<5271 else '7347')
 if len(label)>230:return None
 for pat,target in links:
  if re.search(pat,label,re.I):
   if screen<5271:
    target={5271:4,6922:788,9484:1058,7347:330}.get(target,target)
   if 'view history' in label.lower() and screen==8132:target=8483
   if label.lower()=='view details' and screen==8483:target=8717
   return None if target==screen else 'route:'+str(target)
 if ('button'in name or 'link'in name or 'label'in name or 'chip'in name or ('text'in n and re.match(r'^(download|export|save|verify|sign |resend|confirm|cancel|pass$|edit$|clear|sync|copy|regenerate|change|start|submit|send|log out|call|view )',label,re.I))) and label:
  if 'shadow'in name or 'margin'in name:return None
  return 'tap:'+label
 return None
text_runs=json.loads((base/'website/design/driver/text_runs.json').read_text())
index=[]
for i,(role,title) in route_names.items():
 root=json.load(open(base/f'website/design/driver/spec/1174_{i}.json'));initial={}
 def convert(n,parent=None,inside_action=False):
  name=n['name'];sname=name.lower();props=extra.get(n['id'],{})
  if not props.get('visible',True):return None
  if 'iosstatusbar'in sname or name=='Nav' or 'tab navigation'in sname or name== 'Container' and n.get('w',0)>=399 and n.get('h',0)<70 and all(t in texts(n)for t in ['Home','Students','Stops','Duties']):return None
  if sname.endswith(':shadow'):return None
  p=coords.get(n['id'],{'x':0,'y':0});x,y=p['x'],p['y']
  if parent and parent.get('type')=='GROUP':
   pp=coords.get(parent['id'],{'x':0,'y':0});x-=pp['x'];y-=pp['y']
  d={'id':n['id'].replace(':','_'),'name':name,'x':x,'y':y,'w':n.get('w',0),'h':n.get('h',0),'opacity':n.get('opacity',1)}
  if parent is None:d['x']=d['y']=0
  d['clips']=props.get('clips',False)
  d['align']=props.get('align','LEFT');d['verticalAlign']=props.get('verticalAlign','TOP')
  fill=n.get('fill',{});d['fill']=fill.get('hex');d['stroke']=n.get('stroke',{}).get('hex')
  if fill.get('stops'):d['gradient']=[s['color']for s in fill['stops']]
  radius=n.get('radius',0);d['radius']=max(radius.values())if isinstance(radius,dict)else radius
  d['effects']=n.get('effects',[])
  if n['id'] in assets:
   stem=n['id'].replace(':','_');ap=base/'mobile app/driver/assets/figma'
   if (base/'website/design/driver/source_assets'/(stem+'.error')).exists():return None
   ext='png'if(ap/(stem+'.png')).exists()else'svg'
   d['asset']='assets/figma/'+stem+'.'+ext
   d['opacity']=1
   if ext=='svg':
    tag=re.search(r'<svg[^>]*>',(ap/(stem+'.svg')).read_text()).group(0)
    wm=re.search(r'width="([0-9.]+)',tag);hm=re.search(r'height="([0-9.]+)',tag)
    if wm and hm:d['assetWidth']=float(wm[1]);d['assetHeight']=float(hm[1])
   else:
    with Image.open(ap/(stem+'.png'))as im:d['assetWidth']=im.width/2;d['assetHeight']=im.height/2
   d['assetOffsetX']=props.get('paintOffset',{}).get('x',-(d.get('assetWidth',d['w'])-d['w'])/2)
   d['assetOffsetY']=props.get('paintOffset',{}).get('y',-(d.get('assetHeight',d['h'])-d['h'])/2)
   a=intent(n,i)
   if not a:
    for c in n.get('children',[]):
     a=intent(c,i)
     if a:break
   if i in [4,6922] and n.get('fill',{}).get('type')=='IMAGE':a='route:'+('788'if i==4 else'8924')
   if a:
    d['action']=a
    d['semanticLabel']='Go back'if a=='back'else re.sub(r'^[0-9.\s]+','',route_names[int(a.split(':')[1])][1])if a.startswith('route:')else name
   if i in [9484,1058]and re.search(r'QR|barcode',n['name'],re.I):d['action']='route:9679'if i==9484 else'tap:Demo credential';d['semanticLabel']='Show verification code'
   def has_image(node):return node.get('fill',{}).get('type')=='IMAGE' or any(has_image(c)for c in node.get('children',[]))
   children=n.get('children',[])
   if n['type']=='GROUP' and len(children)==2 and 60<n.get('w',0)<120 and n.get('h',0)<60 and has_image(children[1]):
    d.pop('action',None);d['children']=[]
    for child,action,label in zip(children,['notifications','profile'],['Notifications','Profile']):
     cp=coords[child['id']]
     d['children'].append({'id':child['id'].replace(':','_'),'name':label,'x':cp['x']-p['x'],'y':cp['y']-p['y'],'w':child['w'],'h':child['h'],'action':action,'semanticLabel':label})
   if n['id']=='1174:9701':
    d['children']=[{'id':'1174_9706','name':'Close verification code','x':356.646,'y':35.046,'w':32.98,'h':32.98,'action':'back','semanticLabel':'Close verification code'}]
   return d
  if 'text'in n:
   t=n['text'];d['text']=t.get('characters','')
   if n['id'] in text_runs:
    d['textRuns']=[]
    for run in text_runs[n['id']]:
     style=run['style'].lower();weight=800 if'extra'in style else 600 if'semi'in style else 700 if'bold'in style else 500 if'medium'in style else 400
     d['textRuns'].append({'text':run['text'],'size':run['size'],'weight':weight,'color':run['color'],'spacing':run['spacing']})
   if i==7759 and 'Resend code' in d['text']:d['text']='Demo code: 482916 • Resend'
   if i==7629 and '6-digit one-time' in d['text']:d['text']='Demo access uses code 482916. No SMS is sent.'
   size=t.get('fontSize',14);d['fontSize']=size if isinstance(size,(int,float)) else 14
   style=t.get('fontStyle','Regular').lower();d['fontWeight']=800 if'extra'in style else 600 if'semi'in style else 700 if'bold'in style else 500 if'medium'in style else 400
   if i in [5638,6027,6416]and re.fullmatch(r'(0|28)\s*/\s*34',d['text']):d['binding']='trip.boardedRatio'
   if i==4 and d['text']=='0':d['binding']='trip.boarded'
   if i==7759 and re.fullmatch(r'\+91\s*98765\s*43210',d['text']):d['binding']='auth.phone'
   if i==6416:
    if re.fullmatch(r'\d+ Students Onboard',d['text']):d['binding']='trip.onboardLabel'
    if d['text'].startswith('Total Vehicle Seats:'):d['binding']='trip.seats'
    if re.fullmatch(r'\d+% CAP',d['text']):d['binding']='trip.capacity'
    if re.fullmatch(r'0\s*/\s*6',d['text']):d['binding']='trip.stopBoarded'
   if i==9783 and d['text']=='2 Pending':d['binding']='trip.pendingChecks'
   if i==9783 and d['text']=='14 of 16 Done':d['binding']='trip.checked'
   spacing=t.get('letterSpacing',0);d['letterSpacing']=float(spacing[:-1])/100*d['fontSize'] if isinstance(spacing,str)and spacing.endswith('%')else float(spacing)if isinstance(spacing,(int,float))else 0
   d['color']=t.get('color',{}).get('hex','#191C1E');lh=t.get('lineHeight');d['lineHeight']=float(lh[:-1])/100 if isinstance(lh,str)and lh.endswith('%')else lh/d['fontSize'] if isinstance(lh,(int,float))and d['fontSize']else None
  # Native inputs preserve source insets so their leading icons stay clear.
  if (name in ['Input','Textarea'] and n.get('w',0)>70) or (i==7759 and n.get('w')==46 and n.get('h')==56) or (i==15553 and 35<n.get('w',0)<65 and n.get('h')==48 and re.fullmatch(r'\d',clean(texts(n)))):
   d['input']=True;d['multiline']=name=='Textarea'
   if i==12538 and n['id']=='1174:12729':d['readOnly']=True
   pad=n.get('padding',{});d['fieldPadding']=[pad.get(k,0)for k in ['l','t','r','b']]
   value=clean(texts(n));placeholder=value.lower().startswith('search') or value=='Enter 4-digit OTP'
   initial[d['id']]='' if i==7759 or placeholder else value
   d['inputHint']='' if i==7759 else value if placeholder else None
   d['text']=initial[d['id']];return d
  a=None if inside_action else intent(n,i)
  # Bind at the smallest meaningful interactive container, not whole content blocks.
  click_container=any(k in sname for k in ['button','link','label','chip']) or ('text'in n and len(clean(texts(n)))<65)
  # Groups must not consume the pointer events of their individual controls.
  grouped=any(k in sname for k in ['buttons','action row','filter chips','chips strip','chips carousel']) or sname.startswith('section')
  if grouped and clean(texts(n))!='Pass':click_container=False
  if name.startswith('Label'):
   if any(k in sname for k in ['card','option']):d['interaction']='choice'
   elif checkbox_label(n):d['interaction']='toggle'
   elif not any(k in sname for k in ['card','option']):click_container=False
  if a and click_container and not ('Sign Out' in clean(texts(n)) and clean(texts(n))!='Sign Out'):d['action']=a
  if i in [15003,15282]and n.get('h',0)<100 and re.search(r'^(Lead Driver|Bus Attendant)$',clean(texts(n)),re.I):d['action']='tap:'+clean(texts(n))
  if i==9783 and clean(texts(n))=='Pass' and 'buttons' in sname:d['action']='tap:Pass'
  if n.get('w',0)<=60 and n.get('h',0)<=35 and ('Label'in n['name'])and not texts(n):d['action']='tap:Toggle setting'
  kids=[c for child in n.get('children',[]) if (c:=convert(child,n,inside_action or bool(d.get('action'))))]
  if kids:d['children']=kids
  if d.get('interaction') in ['toggle','choice']:
   for child in kids:
    if child['name'].startswith('Input') or (child['name']=='Background' and child['w']<=36 and child['h']<=36):
     child['toggleFor']=d['id'];child['interaction']=d['interaction'];child.pop('asset',None);child.pop('children',None)
  if d.get('action'):
   a=d['action'];label=clean(texts(n))
   if a.startswith('route:'):
    target=int(a.split(':')[1]);label=re.sub(r'^[0-9.\s]+','',route_names[target][1])
   elif a=='back':label='Go back'
   d['semanticLabel']=label or name
  extent=max([c['y']+c['h']for c in kids]+[0]);
  if extent>d['h']+6 and d['h']>120 and d['w']>260:d['scroll']=True
  return d
 converted=convert(root)
 # Full-canvas export wrappers must not hide the page's actual scroll region.
 while len(converted.get('children',[]))==1:
  wrapper=converted['children'][0]
  if not wrapper.get('children') or abs(wrapper['x'])>1 or abs(wrapper['y'])>1 or abs(wrapper['w']-converted['w'])>1 or abs(wrapper['h']-converted['h'])>1:break
  converted['children']=wrapper['children']
  converted['fill']=wrapper.get('fill') or converted.get('fill')
 # A single-child structural wrapper is content, not a second scroll viewport.
 # Expanding it prevents nested scrolling from hiding focused controls under headers.
 def expand_wrappers(node):
  children=node.get('children',[])
  for child in children:expand_wrappers(child)
  if node['name'].startswith('Frame ') and node.get('scroll') and len(children)==1:
   node['h']=max(node['h'],children[0]['y']+children[0]['h']);node['scroll']=False
 expand_wrappers(converted)
 def contains_footer(node):
  return any(k in node['name'].lower() for k in ['floating / sticky action bar','emergency action row','primary action button','footer - bottom actions']) or any(contains_footer(c)for c in node.get('children',[]))
 def repair_flow(node,is_root=False):
  children=node.get('children',[])
  for child in children:repair_flow(child)
  # Off-artboard action docks belong after the content, never behind its cards.
  footers=[c for c in children if c['y']>converted['h']*.75 and (c['y']>=converted['h'] or c['h']>=160) and contains_footer(c)]
  others=[c for c in children if c not in footers]
  edge=max([c['y']+c['h']for c in others]+[0])
  for footer in footers:
   if footer['y']<edge:footer['y']=edge+16
   edge=max(edge,footer['y']+footer['h'])
  extent=max([c['y']+c['h']for c in children]+[node['h']])
  structural=(not node.get('stroke') and not node.get('radius')) or (node['h']>converted['h']*.5 and node['w']>260)
  if not is_root and structural:
   if extent>node['h']+2:node['h']=extent;node['clips']=False
   if node.get('scroll'):node['scroll']=False
 repair_flow(converted,True)
 record={'id':str(i),'title':title,'role':role,'feature':lookup[i],'modal':'popup'in title.lower(),'initialValues':initial,'root':converted}
 (out/f'{i}.json').write_text(json.dumps(record,separators=(',',':')))
 index.append({k:record[k]for k in ['id','title','role','feature','modal']})
(out/'index.json').write_text(json.dumps(index,indent=2))
print('Generated',len(index),'native view contracts')
