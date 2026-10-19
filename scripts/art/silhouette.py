"""Keep the principal connected silhouette while retaining original source pixels."""
from collections import deque
from PIL import Image,ImageFilter

def main_silhouette(image):
    # Expand the selection by two pixels so fine dark edges and small line gaps survive.
    selection=image.convert('RGB').point(lambda v:255 if v>10 else 0).convert('L').point(lambda v:255 if v else 0).filter(ImageFilter.MaxFilter(5))
    w,h=selection.size; pixels=selection.tobytes(); seen=bytearray(w*h); components=[]
    for start,value in enumerate(pixels):
        if not value or seen[start]: continue
        seen[start]=1; queue=deque([start]); component=[]
        while queue:
            i=queue.popleft(); component.append(i); x=i%w; y=i//w
            for j in ((i-1 if x else -1),(i+1 if x+1<w else -1),(i-w if y else -1),(i+w if y+1<h else -1)):
                if j>=0 and not seen[j] and pixels[j]: seen[j]=1;queue.append(j)
        components.append(component)
    if not components:return image
    largest=max(components,key=len); data=bytearray(w*h)
    for i in largest:data[i]=255
    mask=Image.frombytes('L',(w,h),bytes(data)); result=Image.new('RGB',image.size); result.paste(image,mask=mask)
    return result
