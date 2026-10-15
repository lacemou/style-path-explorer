"""Make labeled source-image contact sheets for human comparison (not generated evidence)."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
reports=json.loads((ROOT/'research/comparison.json').read_text())
cat=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
paths={s['id']:ROOT/s['avatar'] for s in cat['styles']}
out=ROOT/'output/review';out.mkdir(parents=True,exist_ok=True)
for batch in range(4):
    sheet=Image.new('RGB',(1550,1400),'#111315');d=ImageDraw.Draw(sheet)
    for local,index in enumerate(range(batch*4,batch*4+4)):
        y=local*350;r=reports[0]['routes'][index]
        d.text((15,y+5),f"{r['from']} -> {r['to']}",fill='#eeeeee')
        for m,report in enumerate(reports):
            cy=y+35+m*102;d.text((15,cy+30),report['method'],fill='#aaaaaa')
            ids=report['routes'][index]['ids']
            if not ids:d.text((115,cy+30),'NO PATH',fill='#bb9990')
            for j,id in enumerate(ids):
                im=Image.open(paths[id]).convert('RGB');im.thumbnail((88,88));x=115+j*100
                sheet.paste(im,(x,cy));d.text((x,cy+88),id,fill='#aaaaaa')
    sheet.save(out/f'fixed-pairs-{batch+1}.jpg')
print('Four source contact sheets written.')
