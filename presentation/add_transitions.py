"""Adds slide transitions (fade; push for section dividers) to the built deck.  python presentation/add_transitions.py"""
import os, re, shutil, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "GSTiQ_Group_One_Presentation.pptx")
DIVIDERS = {4, 7, 13, 21, 25, 31}
tmp = SRC + ".tmp"
with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", item.filename)
        if m and b"<p:transition" not in data:
            n = int(m.group(1))
            tr = b'<p:transition spd="slow"><p:push dir="u"/></p:transition>' if n in DIVIDERS else b'<p:transition spd="med"><p:fade/></p:transition>'
            data = data.replace(b"</p:clrMapOvr>", b"</p:clrMapOvr>" + tr, 1)
        zout.writestr(item, data)
shutil.move(tmp, SRC)
print("transitions added")
