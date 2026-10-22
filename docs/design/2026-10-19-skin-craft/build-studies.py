"""Original vector studies. These are geometry/colour comparisons, not browser evidence."""
from pathlib import Path
from html import escape
root=Path(__file__).parent/'references'

def svg(name,w,h,body):
 root.joinpath(name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#eeeede"/><g font-family="Arial,sans-serif" fill="#29382e">{body}</g></svg>')
def text(x,y,label,size=15): return f'<text x="{x}" y="{y}" font-size="{size}">{escape(label)}</text>'
def disc(cx,cy,r=110): return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#30362b" stroke="#868b73" stroke-width="5"/><circle cx="{cx}" cy="{cy}" r="37" fill="#d98a47"/><path d="M{cx-8} {cy-13}l23 13-23 13z" fill="#30362b"/>'
body=text(40,40,'GROOVE / TWO ARM LAYOUTS',24)+text(40,68,'Geometry sketches • dashed arm = park • solid arm = RUN')
for idx,(title,path,note) in enumerate([
 ('A / STRAIGHT','M282 20V185','Direct shaft: a longer sweep crowds the right edge.'),
 ('B / OFFSET — WORKING CANDIDATE','M282 20V147L268 181','Offset headshell: parked outside the main thumb path.')]):
 x=40+idx*390
 body+=f'<g transform="translate({x} 105)"><rect width="350" height="405" rx="22" fill="#b2aa86" stroke="#8c8e6d"/>{disc(160,205)}<g transform="translate(10 65)">'
 for deg,opacity,dash in [(-10,'.45','6 5'),(20,'1','none')]:
  body+=f'<g transform="rotate({deg} 282 41)" opacity="{opacity}"><path d="{path}" fill="none" stroke="#4e5949" stroke-width="8" stroke-dasharray="{dash}"/><path d="{path}" fill="none" stroke="#e7e5d0" stroke-width="4" stroke-dasharray="{dash}"/></g>'
 body+='<circle cx="282" cy="41" r="10" fill="#7e8975" stroke="#e1dfca"/></g></g>'
 body+=text(x,550,title,17)+text(x,581,note,12)
body+=text(40,635,'Candidate B is implemented. Owner choice and physical-device review remain open.',14)
svg('groove-arm-layouts.svg',820,675,body)
body=text(40,40,'APERTURE / IRIS OR IRIS + FILM',24)+text(40,68,'Composition studies • no new controls or implied recording')
for i in range(2):
 x=40+i*390
 body+=f'<g transform="translate({x} 105)"><rect width="350" height="365" rx="18" fill="#3a454d"/>{disc(165,190)}'
 for deg in range(0,360,60):body+=f'<path d="M165 82A108 108 0 0 1 258.5 136L208 190 186.5 152.8Z" transform="rotate({deg} 165 190)" fill="#6d7d7e" stroke="#a7b5a8"/>'
 body+='<circle cx="165" cy="190" r="32" fill="#d6c8a4"/>'
 if i:
  body+='<rect x="295" y="65" width="32" height="242" rx="4" fill="#1d2828"/>'
  for y in range(74,294,20):body+=f'<rect x="300" y="{y}" width="5" height="9" fill="#bdac85"/><rect x="317" y="{y}" width="5" height="9" fill="#bdac85"/>'
  for y in range(83,279,53):body+=f'<rect x="308" y="{y}" width="7" height="39" fill="#735c42"/>'
 body+='</g>'+text(x,507,['A / CLEAN IRIS — WORKING CANDIDATE','B / FILM WINDOW EXPLORATION'][i],15)
body+=text(40,553,'A keeps the optical silhouette clear. Tape already has a full scene in Field / Spool.',14)
body+=text(40,580,'B remains a composition sketch, not an extra production mechanism.',14)
svg('aperture-compositions.svg',820,620,body)
rows=[('Clear',('#d8e3de','#c8d6cb','#c25232','#1c3027'),('#e7d5b3','#b7c8bd','#447261','#293e35')),
 ('Spool',('#50445f','#b9afcb','#d5df9b','#f3edf5'),('#826b4f','#c6af7b','#eed3ad','#201f1b')),
 ('Glaze',('#d9a6a1','#eed1c4','#7a393c','#432c29'),('#b6cad0','#d7e2da','#406f73','#233c42')),
 ('Pop',('#dfdc86','#454ca2','#dc7450','#2c3430'),('#c0b6dc','#df8a63','#566f55','#303531')),
 ('Moss',('#4e5e47','#94734f','#d8dbc0','#eff0d6'),('#d2c5ab','#755e47','#3d6858','#243d30')),
 ('Mono',('#232726','#eeeee4','#eeeee4','#eeeee4'),('#e2e2d5','#38453b','#38453b','#26362e'))]
body=text(35,40,'COLOUR TRIALS / SAME GEOMETRY, TWO PALETTES',23)+text(35,66,'A = implemented candidate • B = alternate study • compare with real rendered evidence separately')
for i,(name,a,b) in enumerate(rows):
 y=100+i*245
 body+=text(35,y+22,name,20)
 for j,(shell,rim,key,ink) in enumerate([a,b]):
  x=200+j*410
  rad={'Pop':5,'Mono':0,'Glaze':25}.get(name,15)
  body+=f'<g transform="translate({x} {y})"><rect width="210" height="215" rx="{rad}" fill="{shell}" stroke="{ink}" stroke-opacity=".5"/>'
  body+=f'<circle cx="105" cy="110" r="70" fill="{rim}"/><circle cx="105" cy="110" r="58" fill="{shell}"/><rect x="81" y="86" width="48" height="48" rx="10" fill="{key}"/><path d="M99 100l17 10-17 10z" fill="{shell}"/>'
  if name in ['Clear','Spool']:
   body+=f'<rect x="7" y="7" width="196" height="201" rx="{rad}" fill="none" stroke="{ink}" stroke-opacity=".4"/><path d="M13 40h30v17m154 80v50h-27M14 175h31v22" stroke="{ink}" stroke-opacity=".4" fill="none"/><path d="M166 74h28v70h-21" stroke="{key}" stroke-width="4" fill="none"/><circle cx="179" cy="74" r="12" fill="{rim}" stroke="{ink}"/>'
  body+=f'<path d="M35 194h140" stroke="{ink}" stroke-width="2"/><text x="14" y="25" fill="{ink}" font-size="11">{name.upper()}</text></g>'
  body+=text(x+228,y+30,['A','B'][j],19)
  for c,col in enumerate([shell,rim,key,ink]):body+=f'<rect x="{x+230}" y="{y+50+c*30}" width="22" height="22" rx="3" fill="{col}"/>'+text(x+261,y+65+c*30,col,12)
svg('palette-trials.svg',1030,1585,body)
