
await Promise.all([{family:"Noto Sans Khmer",style:"Regular"},{family:"Noto Sans Khmer",style:"SemiBold"},{family:"Noto Sans Khmer",style:"Bold"},{family:"Inter",style:"Bold"}].map(f=>figma.loadFontAsync(f)));
const vars=Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map(v=>[v.name,v]));
const styles=Object.fromEntries((await figma.getLocalTextStylesAsync()).map(s=>[s.name.split("/")[1],s]));
function fill(n,key){n.fills=[figma.variables.setBoundVariableForPaint({type:"SOLID",color:{r:1,g:1,b:1}},"color",vars[key])];}
function rad(n,v=16){n.cornerRadius=v;n.setBoundVariable("cornerRadius",vars["radius/"+v]);}
function gap(n,v=12){n.itemSpacing=v;n.setBoundVariable("itemSpacing",vars["space/"+v]);}
function pad(n,v=16){for(const p of ["paddingTop","paddingBottom","paddingLeft","paddingRight"]){n[p]=v;n.setBoundVariable(p,vars["space/"+v]);}}
function stroke(n){n.strokes=[figma.variables.setBoundVariableForPaint({type:"SOLID",color:{r:0,g:0,b:0}},"color",vars["color/border"])];n.strokeWeight=1;n.setBoundVariable("strokeWeight",vars["border/width"]);}
function box(parent,name,dir="VERTICAL",w=358,bg=null,p=0,g=12){const n=figma.createAutoLayout(dir);n.name=name;n.resize(w,40);n.primaryAxisSizingMode="AUTO";n.counterAxisSizingMode="FIXED";gap(n,g);pad(n,p);n.fills=[];if(bg)fill(n,bg);parent.appendChild(n);return n;}
async function txt(parent,name,value,role="Body",color="color/text/primary",width=null){const n=figma.createText();n.name=name;await n.setTextStyleIdAsync(styles[role].id);n.characters=value;fill(n,color);parent.appendChild(n);if(width!==null){n.resize(width,n.height);n.textAutoResize="HEIGHT";n.layoutSizingHorizontal="FILL";}else{n.textAutoResize="WIDTH_AND_HEIGHT";}return n;}
function ids(root){return [root.id,...root.findAll(()=>true).map(n=>n.id)];}
function expose(c,n,label,value){const key=c.addComponentProperty(label,"TEXT",value);n.componentPropertyReferences={characters:key};return key;}
async function ctext(c,name,value,role="Body",color="color/text/primary",w=null){const n=await txt(c,name,value,role,color,w);expose(c,n,name,value);return n;}
const page=await figma.getNodeByIdAsync(PAGE_ID);await figma.setCurrentPageAsync(page);

const componentIds={"Icon/bag":"6:24","Icon/users":"6:40","Icon/gift":"6:56","Icon/clock":"6:72","Icon/search":"6:88","Icon/plus":"6:104","Icon/check":"6:120","Icon/settings":"6:136","Icon/home":"6:152","Icon/offline":"6:168","Icon/wallet":"6:171","Icon/qr":"6:175","DataRow":"6:236","Metric":"6:241","Product":"6:245","CartLine":"6:253","Toggle":"6:257","StatusBar":"7:20","AppHeader":"7:24","Total":"7:29","Food/Dumplings":"7:33","Food/Meatballs":"7:38","Food/Tea":"7:47","Food/Frozen":"7:54"}, familyIds={"Button":["6:189","6:191","6:193","6:195","6:197","6:199"],"Badge":["6:201","6:203","6:205","6:207"],"Field":["6:209","6:212"],"Choice":["6:216","6:221"],"NavItem":["6:226","6:231"]}, foods={"Dumplings":"7:33","Meatballs":"7:38","Tea":"7:47","Frozen":"7:54"};
async function instance(parent,id,props={},width=null){const c=await figma.getNodeByIdAsync(id);const i=c.createInstance();parent.appendChild(i);const actual={};for(const [k,v]of Object.entries(props)){const key=Object.keys(i.componentProperties).find(s=>s===k||s.startsWith(k+"#"));if(key)actual[key]=v;}if(Object.keys(actual).length)i.setProperties(actual);if(width!==null){i.resize(width,i.height);i.layoutSizingHorizontal="FILL";}return i;}
async function button(p,label,tone=0,disabled=false){return instance(p,familyIds.Button[tone*2+(disabled?1:0)],{Label:label},p.width-p.paddingLeft-p.paddingRight);}
async function badge(p,label,tone=0){return instance(p,familyIds.Badge[tone],{Label:label});}
async function field(p,label,value,error=null){return instance(p,familyIds.Field[error?1:0],{Label:label,Value:value,...(error?{Error:error}:{})},p.width-p.paddingLeft-p.paddingRight);}
async function choice(p,label,selected=false,ico="check"){return instance(p,familyIds.Choice[selected?1:0],{Label:label,Icon:componentIds["Icon/"+ico]},p.width-p.paddingLeft-p.paddingRight);}
async function row(p,title,detail,value="›"){return instance(p,componentIds.DataRow,{Title:title,Detail:detail,Value:value},p.width-p.paddingLeft-p.paddingRight);}
async function line(p,name,detail,price){return instance(p,componentIds.CartLine,{Name:name,Detail:detail,Price:price},p.width-p.paddingLeft-p.paddingRight);}
async function total(p,amount,equiv="≈ $3.50 · 1 USD = ៛ 4,000"){return instance(p,componentIds.Total,{Amount:amount,Equivalent:equiv},p.width-p.paddingLeft-p.paddingRight);}
async function note(p,value,tone="secondary"){return txt(p,"Helper",value,"Caption",tone==="danger"?"color/danger":tone==="warning"?"color/warning":"color/text/secondary",p.width-p.paddingLeft-p.paddingRight);}
async function heading(p,value){return txt(p,"Section heading",value,"Title",undefined,p.width-p.paddingLeft-p.paddingRight);}
async function nav(p,active=0,admin=false){const n=box(p,"Bottom navigation","HORIZONTAL",390,"color/bg/surface",16,8);stroke(n);const labels=admin?["សង្ខេប","សាខា","បុគ្គលិក","កំណត់"]:["លក់","ទុកសិន","វិក្កយបត្រ","វេន"],icons=admin?["home","home","users","settings"]:["bag","clock","bag","wallet"];for(let j=0;j<4;j++){const i=await instance(n,familyIds.NavItem[j===active?1:0],{Label:labels[j],Icon:componentIds["Icon/"+icons[j]]});i.resize(83.5,i.height);i.layoutSizingHorizontal="FILL";}return n;}
const screens={},screenRoots=[];
async function phone(name,index,{admin=false,active=0,noNav=false,title=null}={}){const s=figma.createAutoLayout("VERTICAL");s.name=name;s.resize(390,844);s.primaryAxisSizingMode="FIXED";s.counterAxisSizingMode="FIXED";gap(s,0);pad(s,0);fill(s,"color/bg/canvas");rad(s,32);s.clipsContent=true;board.appendChild(s);s.x=32+(index%4)*430;s.y=150+Math.floor(index/4)*1040;screenRoots.push(s);screens[name]=s.id;
const top=box(s,"Safe-area and header","VERTICAL",390,null,16,4);await instance(top,componentIds.StatusBar,{},358);await instance(top,componentIds.AppHeader,{Title:admin?"OneBite Admin":"OneBite",Subtitle:admin?"ម្ចាស់ · សាខាទាំងអស់":"សាខា 01 · សុខា"},358);
const b=box(s,"Scrollable content","VERTICAL",390,null,16,12);b.layoutSizingVertical="FILL";b.clipsContent=true;if(title)await heading(b,title);
const foot=box(s,"Primary actions","VERTICAL",390,null,16,8);
if(!noNav)await nav(s,active,admin);
return {s,b,f:foot};}
async function productGrid(p,english=false){for(let r=0;r<3;r++){const pair=box(p,"Menu row","HORIZONTAL",358,null,0,12);const menu=english?[["Fried dumplings","Small · 5 pcs","៛ 5,000","Dumplings"],["Fried dumplings","Large · 10 pcs","៛ 9,000","Dumplings"],["Fried meatballs","Small · 10 pcs","៛ 5,000","Meatballs"],["Fried meatballs","Large · 20 pcs","៛ 9,000","Meatballs"],["Lemon tea","One size","៛ 4,000","Tea"],["Frozen dumplings","Bag · 20 pcs","៛ 15,000","Frozen"]]:[["គាវចៀន","ប្រអប់តូច · 5 គ្រាប់","៛ 5,000","Dumplings"],["គាវចៀន","ប្រអប់ធំ · 10 គ្រាប់","៛ 9,000","Dumplings"],["ប្រហិតចៀន","ប្រអប់តូច · 10 គ្រាប់","៛ 5,000","Meatballs"],["ប្រហិតចៀន","ប្រអប់ធំ · 20 គ្រាប់","៛ 9,000","Meatballs"],["តែក្រូចឆ្មា","ទំហំតែមួយ","៛ 4,000","Tea"],["គាវក្លាសេ","1 ថង់ · 20 គ្រាប់","៛ 15,000","Frozen"]];for(let j=0;j<2;j++){const d=menu[r*2+j];await instance(pair,componentIds.Product,{Name:d[0],Detail:d[1],Price:d[2],Food:foods[d[3]]});}}}

