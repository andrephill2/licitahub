import json

src = r"C:\Users\SOS DOCS\licitahub\frontend\src\data\capag.json"
dst = r"C:\Users\SOS DOCS\licitahub\frontend\src\data\capag.json"

with open(src, encoding="utf-8") as f:
    data = json.load(f)

# Mantém só o essencial para o lookup: uf + mun_norm + nota (A/B/C/D/SC)
compact = [{"u": d["uf"], "m": d["mun_norm"], "n": d["nota"]} for d in data]

with open(dst, "w", encoding="utf-8") as f:
    json.dump(compact, f, ensure_ascii=False, separators=(",", ":"))

print(f"Compactado: {len(compact)} registros -> {len(json.dumps(compact))} chars")
