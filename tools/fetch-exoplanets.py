"""Refresh the bundled NASA Exoplanet Archive catalogue (Python 3, stdlib only)."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "universe" / "exoplanets.json"
COLUMNS = "hostname,pl_name,pl_letter,pl_orbsmax,pl_orbper,pl_rade,pl_bmasse,pl_bmassprov,pl_controv_flag,st_teff,st_rad,sy_dist,sy_snum"
QUERY = "select " + COLUMNS + " from pscomppars order by hostname,pl_name"
URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?" + urllib.parse.urlencode({"query": QUERY, "format": "json"})


def number(value):
    if value is None or value == "":
        return None
    value = float(value)
    return value if math.isfinite(value) and value > 0 else None


def stable_id(prefix, name):
    return prefix + hashlib.sha256(name.encode("utf-8")).hexdigest()[:16]


def main():
    request = urllib.request.Request(URL, headers={"User-Agent": "StarWhisper educational catalogue snapshot/0.1"})
    with urllib.request.urlopen(request, timeout=120) as response:
        rows = json.load(response)
    if not isinstance(rows, list) or len(rows) < 5000:
        raise RuntimeError("The full PSCompPars response is missing or unexpectedly small; existing snapshot was not replaced.")
    systems = {}
    planet_ids = set()
    for row in rows:
        host = str(row["hostname"]).strip()
        name = str(row["pl_name"]).strip()
        if not host or not name:
            raise RuntimeError("A catalogue row is missing its host or planet name.")
        system = systems.setdefault(host, {
            "id": stable_id("system-", host), "name": host, "distanceLy": None,
            "stars": None, "temperatureK": None, "starRadiusSolar": None, "planets": [],
        })
        for field, column in (("stars", "sy_snum"), ("temperatureK", "st_teff"), ("starRadiusSolar", "st_rad")):
            if system[field] is None:
                system[field] = number(row.get(column))
        if system["distanceLy"] is None:
            distance_pc = number(row.get("sy_dist"))
            system["distanceLy"] = round(distance_pc * 3.261563777, 5) if distance_pc is not None else None
        planet_id = stable_id("planet-", name)
        if planet_id in planet_ids:
            raise RuntimeError("Duplicate planet name in PSCompPars response: " + name)
        planet_ids.add(planet_id)
        system["planets"].append({
            "id": planet_id, "name": name, "letter": row.get("pl_letter"),
            "radiusEarth": number(row.get("pl_rade")), "massEarth": number(row.get("pl_bmasse")),
            "massProvenance": row.get("pl_bmassprov"),
            "controversial": row.get("pl_controv_flag") == 1,
            "orbitalPeriodDays": number(row.get("pl_orbper")), "semiMajorAxisAU": number(row.get("pl_orbsmax")),
        })
    ordered = sorted(systems.values(), key=lambda system: (system["distanceLy"] is None, system["distanceLy"] or 0, system["name"].casefold()))
    if len({system["id"] for system in ordered}) != len(ordered):
        raise RuntimeError("System identifier collision.")
    data = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "NASA Exoplanet Archive — Planetary Systems Composite Parameters (PSCompPars)",
        "sourceUrl": URL, "definitionsUrl": "https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html",
        "systemCount": len(ordered), "planetCount": len(rows), "systems": ordered,
        "note": "归档中的已确认系外行星目录快照。组合参数可能来自不同研究，半径或质量可能为推算值；保留归档争议标记，未知值为 null。3D 外观、轨道相位、倾角与多恒星布局为教学示意，不是实测表面、实时位置或完整轨道解。",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"path": str(OUTPUT), "systemCount": data["systemCount"], "planetCount": data["planetCount"], "retrievedAt": data["retrievedAt"], "bytes": OUTPUT.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
