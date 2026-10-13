import csv
import json
import os

def clean_int(val, default=0):
    if val is None or val == '' or val == 'NA':
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

def clean_float(val, default=0.0):
    if val is None or val == '' or val == 'NA':
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def process_data():
    volcanoes_file = 'volcano_sample.csv'
    eruptions_file = 'eruptions_sample.csv'

    # 1. Parse eruptions to aggregate by volcano_number
    eruptions_by_volcano = {}
    if os.path.exists(eruptions_file):
        with open(eruptions_file, mode='r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                v_num = row.get('volcano_number')
                if not v_num:
                    continue
                v_num = clean_int(v_num)
                if v_num not in eruptions_by_volcano:
                    eruptions_by_volcano[v_num] = {
                        'count': 0,
                        'max_vei': 0,
                        'vei_history': [],
                        'last_year': None,
                        'notable': None
                    }
                
                info = eruptions_by_volcano[v_num]
                info['count'] += 1
                
                vei_raw = row.get('vei')
                vei = clean_int(vei_raw, default=-1)
                start_year = clean_int(row.get('start_year'), default=None)
                
                if vei >= 0:
                    info['vei_history'].append(vei)
                    if vei > info['max_vei']:
                        info['max_vei'] = vei
                        info['notable'] = {
                            'year': start_year,
                            'vei': vei,
                            'category': row.get('eruption_category', '')
                        }

    # 2. Parse volcanoes and merge
    volcanoes_list = []
    with open(volcanoes_file, mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            v_num = clean_int(row.get('volcano_number'))
            if not v_num:
                continue
            
            name = (row.get('volcano_name') or '').strip().strip('"')
            v_type = (row.get('primary_volcano_type') or 'Unknown').strip()
            # Standardize volcano types into simpler broad categories
            simplified_type = 'Other'
            if 'Stratovolcano' in v_type:
                simplified_type = 'Stratovolcano'
            elif 'Caldera' in v_type:
                simplified_type = 'Caldera'
            elif 'Shield' in v_type:
                simplified_type = 'Shield Volcano'
            elif 'Complex' in v_type:
                simplified_type = 'Complex Volcano'
            elif 'Submarine' in v_type:
                simplified_type = 'Submarine'
            elif 'Pyroclastic' in v_type or 'Cone' in v_type:
                simplified_type = 'Pyroclastic Cone'
            elif 'Dome' in v_type:
                simplified_type = 'Lava Dome'

            lat = clean_float(row.get('latitude'))
            lon = clean_float(row.get('longitude'))
            elev = clean_int(row.get('elevation'))
            
            pop_5 = clean_int(row.get('population_within_5_km'))
            pop_10 = clean_int(row.get('population_within_10_km'))
            pop_30 = clean_int(row.get('population_within_30_km'))
            pop_100 = clean_int(row.get('population_within_100_km'))

            erupt_info = eruptions_by_volcano.get(v_num, {
                'count': 0,
                'max_vei': 0,
                'vei_history': [],
                'last_year': None,
                'notable': None
            })

            last_year_str = row.get('last_eruption_year', '')
            last_year = clean_int(last_year_str, default=None) if last_year_str != 'Unknown' else None

            # Calculate a composite Danger Index for sorting / analytical highlights
            vei_val = max(erupt_info['max_vei'], 1)
            danger_score = round(vei_val * (len(str(pop_10)) if pop_10 > 0 else 0), 2)

            volcano_entry = {
                'id': v_num,
                'name': name,
                'country': (row.get('country') or '').strip(),
                'region': (row.get('region') or '').strip(),
                'subregion': (row.get('subregion') or '').strip(),
                'type': v_type,
                'type_category': simplified_type,
                'lat': lat,
                'lon': lon,
                'elevation': elev,
                'tectonic': (row.get('tectonic_settings') or '').strip(),
                'last_eruption_year': last_year,
                'eruption_count': erupt_info['count'],
                'max_vei': erupt_info['max_vei'],
                'notable_eruption': erupt_info['notable'],
                'pop_5km': pop_5,
                'pop_10km': pop_10,
                'pop_30km': pop_30,
                'pop_100km': pop_100,
                'danger_score': danger_score
            }
            volcanoes_list.append(volcano_entry)

    volcanoes_list.sort(key=lambda x: x['pop_10km'], reverse=True)

    os.makedirs('data', exist_ok=True)
    out_path = os.path.join('data', 'volcanoes.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(volcanoes_list, f, ensure_ascii=False, indent=2)

    print(f"Successfully processed {len(volcanoes_list)} volcanoes into {out_path}.")
    print("\nTop 5 volcanoes with highest population within 10km:")
    for v in volcanoes_list[:5]:
        print(f" - {v['name']} ({v['country']}): {v['pop_10km']:,} hab. | Max VEI: {v['max_vei']}")

if __name__ == '__main__':
    process_data()
