"""Extract visual-only features. All neural weights must be local files."""
import argparse, hashlib, json, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]

def norm(a):
    return a / np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-12)

def baseline(im):
    rgb=np.asarray(im.resize((128,128)),dtype=np.float32)/255
    color=np.histogramdd(rgb.reshape(-1,3),bins=(8,8,8),range=((0,1),)*3)[0].ravel()
    gray=rgb.mean(axis=2); gy,gx=np.gradient(gray); mag=np.hypot(gx,gy); direction=np.arctan2(gy,gx)
    edge=[]
    for ys in np.array_split(np.arange(128),3):
        for xs in np.array_split(np.arange(128),3):
            d=direction[np.ix_(ys,xs)];m=mag[np.ix_(ys,xs)]
            edge.extend(np.histogram(d,bins=12,range=(-np.pi,np.pi),weights=m)[0])
    return np.concatenate([norm(color),norm(np.asarray(edge))*0.7])

def square(im):
    # Preserve the complete image; never silently center-crop it.
    return ImageOps.pad(im,(224,224),method=Image.Resampling.BICUBIC,color=(255,255,255))

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--method',choices=['baseline','dino','clip'],required=True)
    p.add_argument('--weights',type=Path)
    p.add_argument('--dino-repo',type=Path)
    p.add_argument('--threads',type=int,default=4)
    p.add_argument('--batch-size',type=int,default=12)
    args=p.parse_args()
    cat=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
    images=[square(Image.open(ROOT/s['avatar']).convert('RGB')) for s in cat['styles']]
    start=time.time(); model=None
    if args.method!='baseline':
        if not args.weights or not args.weights.is_file(): p.error('Provide an existing local --weights file')
        import torch
        torch.set_num_threads(args.threads)
        if args.method=='dino':
            if not args.dino_repo: p.error('Provide a pinned local --dino-repo checkout')
            model=torch.hub.load(str(args.dino_repo),'dinov2_vits14',source='local',pretrained=False)
            state=torch.load(args.weights,map_location='cpu',weights_only=True)
            model.load_state_dict(state)
            from torchvision import transforms
            preprocess=transforms.Compose([transforms.ToTensor(),transforms.Normalize((.485,.456,.406),(.229,.224,.225))])
        else:
            import open_clip
            model,_,preprocess=open_clip.create_model_and_transforms('ViT-B-32',pretrained=str(args.weights),device='cpu')
        model.eval()
        batches=[]
        with torch.inference_mode():
            for i in range(0,len(images),args.batch_size):
                tensor=torch.stack([preprocess(im) for im in images[i:i+args.batch_size]])
                result=model(tensor) if args.method=='dino' else model.encode_image(tensor)
                batches.append(result.cpu().float().numpy())
                print(f'{args.method}: {min(i+args.batch_size,len(images))}/{len(images)} ({time.time()-start:.1f}s)',flush=True)
        vectors=np.concatenate(batches)
    else: vectors=np.stack([baseline(im) for im in images])
    vectors=norm(vectors).astype(np.float32)
    dest=ROOT/'.runtime/features';dest.mkdir(parents=True,exist_ok=True)
    np.save(dest/f'{args.method}.npy',vectors)
    weights_hash=hashlib.sha256(args.weights.read_bytes()).hexdigest() if args.weights else None
    meta={'method':args.method,'datasetVersion':cat['version'],'count':len(images),'dimensions':vectors.shape[1],'seconds':round(time.time()-start,2),'weightsSha256':weights_hash,'preprocessing':'RGB; complete image padded to 224 square, bicubic; '+('128px RGB histogram and gradient baseline' if args.method=='baseline' else 'native model normalization'),'ids':[s['id'] for s in cat['styles']]}
    (dest/f'{args.method}.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    print(json.dumps(meta,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
