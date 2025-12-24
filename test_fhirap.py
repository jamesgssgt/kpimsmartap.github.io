import asyncio
import random
import time
import json
import os
from datetime import datetime, timedelta
from fhirpy import AsyncFHIRClient
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"
TOTAL_CASES = 300 
DAYS_BACK = 180

# Load env vars from .env.local manually
def load_env():
    try:
        with open('.env.local', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    val = val.strip('"').strip("'")
                    os.environ[key] = val
        print("Env vars loaded from .env.local")
    except Exception as e:
        print(f"No .env.local found or error reading it: {e}")

load_env()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# 定義三家醫院架構
HOSPITALS = [
    {"code": "TP_GEN", "name": "台北綜合醫院", "risk": 1.0},
    {"code": "NAT_MED", "name": "國立醫學中心", "risk": 1.2}, 
    {"code": "CITY_UN", "name": "市立聯合醫院", "risk": 0.8}
]

DEPT_TEMPLATE = {
    "SURG": {"name": "外科", "docs": ["劉", "張"]},
    "CARDIO": {"name": "心臟科", "docs": ["吳", "蔡"]},
    "ORTHO": {"name": "骨科", "docs": ["王", "李"]}
}

# Global list to store detailed records
KPI_DETAILS_BUFFER = []

def get_long_id():
    prefix = random.choice(['A', 'B', 'H', 'M'])
    ts = str(int(time.time() * 1000000))[-7:]
    rand = str(random.randint(1000, 9999))
    return f"{prefix}{ts}{rand}"

async def create_infrastructure(client):
    print("🏥 建立組織與帳號系統...")
    infra = {}
    auth_db = [] # 用來存帳號資訊
    
    for hosp in HOSPITALS:
        h_code = hosp['code']
        infra[h_code] = {'risk': hosp['risk'], 'depts': []}
        
        # 建立醫院本身的 Organization (作為院長室權限依據)
        hosp_org_id = get_long_id()
        hosp_org = client.resource('Organization', id=hosp_org_id, name=hosp['name'], type=[{'text': 'Hospital'}])
        await hosp_org.save()
        
        # 加入 Auth DB (院長帳號)
        auth_db.append({
            "role": "hospital_admin",
            "name": f"{hosp['name']} (院長室)",
            "id": hosp_org_id,
            "hospitalName": hosp['name']
        })

        for d_code, d_info in DEPT_TEMPLATE.items():
            # 建立科別
            dept_org_id = get_long_id()
            full_dept_name = f"【{hosp['name']}】{d_info['name']}"
            org = client.resource('Organization', id=dept_org_id, name=full_dept_name, partOf={'reference': f"Organization/{hosp_org_id}"})
            await org.save()
            
            dept_docs = []
            for surname in d_info['docs']:
                doc_id = get_long_id()
                doc_name = f"{surname}醫師"
                full_name = f"{doc_name} ({hosp['name'][:2]})"
                
                prac = client.resource('Practitioner', id=doc_id, name=[{'text': full_name}])
                await prac.save()
                dept_docs.append(doc_id)
                
                # 加入 Auth DB (醫師帳號)
                auth_db.append({
                    "role": "doctor",
                    "name": full_name,
                    "id": doc_id,
                    "hospitalName": hosp['name']
                })
            
            infra[h_code]['depts'].append({
                'org_id': dept_org_id,
                'org_name': full_dept_name,
                'dept_code': d_code,
                'doctors': dept_docs,
                'doc_names': {doc_id: f"{surname}醫師" for surname, doc_id in zip(d_info['docs'], dept_docs)}
            })
            
    return infra, auth_db

async def generate_case(client, infra, day_index):
    # Select random hospital, dept, doctor
    hosp_code = random.choice(list(infra.keys()))
    h_data = infra[hosp_code]
    hosp_name = next(h['name'] for h in HOSPITALS if h['code'] == hosp_code)
    
    dept = random.choice(h_data['depts'])
    dept_name = DEPT_TEMPLATE[dept['dept_code']]['name']
    
    doc_id = random.choice(dept['doctors'])
    doc_name = dept['doc_names'][doc_id] # Simple name like '劉醫師'
    
    # Time and Risk
    today = datetime.now()
    case_date = today - timedelta(days=day_index)
    op_start = case_date.replace(hour=random.randint(8, 16))
    op_end = op_start + timedelta(minutes=random.randint(60, 240))
    
    # Admission and Discharge
    admission_date = op_start - timedelta(days=random.randint(1, 2))
    discharge_date = op_end + timedelta(days=random.randint(2, 10))

    risk = 0.015 * h_data['risk']
    if 60 < day_index < 90: risk += 0.08 # 波動
    is_bad = random.random() < risk
    
    # Check if deceased (Numerator)
    is_deceased = False
    abnormal_reason = None
    
    # FHIR Write
    pat_id = get_long_id()
    gender = random.choice(['male', 'female'])
    pat = client.resource('Patient', id=pat_id, gender=gender)
    if is_bad: 
        death_time = op_end + timedelta(hours=random.randint(2, 46))
        pat['deceasedDateTime'] = death_time.strftime('%Y-%m-%dT%H:%M:%S+00:00')
        is_deceased = True
        abnormal_reason = "術後48小時內死亡"
    await pat.save()
    
    enc_id = get_long_id()
    enc = client.resource(
        'Encounter', id=enc_id, status='finished',
        class_={'code': 'IMP'}, subject={'reference': f"Patient/{pat_id}"},
        serviceProvider={'reference': f"Organization/{dept['org_id']}", 'display': dept['org_name']}
    )
    if is_bad: enc['hospitalization'] = {'dischargeDisposition': {'coding': [{'code': 'exp'}]}}
    await enc.save()
    
    proc_id = get_long_id()
    proc = client.resource(
        'Procedure', id=proc_id, status='completed',
        subject={'reference': f"Patient/{pat_id}"}, encounter={'reference': f"Encounter/{enc_id}"},
        performedPeriod={'end': op_end.strftime('%Y-%m-%dT%H:%M:%S+00:00')},
        code={'coding': [{'display': 'Surgery'}]},
        performer=[{'actor': {'reference': f"Practitioner/{doc_id}"}}]
    )
    await proc.save()

    # Collect Data for KPI
    # Indicator: Surgery Mortality (手術死亡率)
    KPI_DETAILS_BUFFER.append({
        "hospital": hosp_name,
        "department": dept_name,
        "doctor": doc_name,
        "indicator_name": "術後48小時死亡率",
        "indicator_def": "手術後死亡人數 / 手術總次數",
        "numerator": 1 if is_deceased else 0,
        "denominator": 1,
        "value": 1 if is_deceased else 0,
        "patient_id": pat_id,
        "gender": gender,
        "abnormal": is_deceased,
        "timestamp": op_start.isoformat(),
        "status": "異常" if is_deceased else "正常",
        "unit": "%",
        "admission_date": admission_date.isoformat(),
        "discharge_date": discharge_date.isoformat(),
        "abnormal_reason": abnormal_reason
    })

def upsert_supabase(table, data):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"Skipping Supabase upload for {table}: Missing Credentials")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" 
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    
    # Simple Loop upload to avoid batch limits or just send whole batch if small enough
    # Supabase REST usually handles array body as insert.
    try:
        http = urllib3.PoolManager()
        encoded_data = json.dumps(data)
        resp = http.request('POST', url, body=encoded_data, headers=headers)
        if resp.status >= 300:
             print(f"Error uploading to {table}: {resp.status} - {resp.data.decode('utf-8')}")
        else:
             print(f"Uploaded {len(data)} records to {table}")
    except Exception as e:
        print(f"Exception uploading to {table}: {e}")

async def main():
    print("🚀 生成資料並建立帳號表...")
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)
    infra, auth_db = await create_infrastructure(client)
    
    tasks = [generate_case(client, infra, random.randint(0, DAYS_BACK)) for _ in range(TOTAL_CASES)]
    
    # 分批執行
    for i in range(0, len(tasks), 50):
        await asyncio.gather(*tasks[i:i+50])
        print(f"進度: {min(i+50, TOTAL_CASES)}/{TOTAL_CASES}")

    print("\n✅ 資料生成完畢！請複製下方的 JSON 到 React 專案中使用：")
    print("="*60)
    print(json.dumps(auth_db, ensure_ascii=False, indent=2))
    print("="*60)

    # Prepare KPI Summary
    # Key: (hospital, department, doctor, indicator_name)
    summary_map = {}
    
    for row in KPI_DETAILS_BUFFER:
        key = (row['hospital'], row['department'], row['doctor'], row['indicator_name'])
        if key not in summary_map:
            summary_map[key] = {
                "hospital": row['hospital'],
                "department": row['department'],
                "doctor": row['doctor'],
                "indicator_name": row['indicator_name'],
                "indicator_def": row['indicator_def'],
                "numerator": 0,
                "denominator": 0,
                "unit": row['unit']
            }
        
        summary_map[key]['numerator'] += row['numerator']
        summary_map[key]['denominator'] += row['denominator']

    kpi_summary_list = []
    for item in summary_map.values():
        if item['denominator'] > 0:
            item['value'] = round((item['numerator'] / item['denominator']) * 100, 2)
        else:
            item['value'] = 0.0
        kpi_summary_list.append(item)

    print("\n📊 上傳 KPI 資料至 Supabase...")
    # Map to table columns provided in prompt:
    # KPI: (科別、醫師、指標名稱、指標定義、指標值，分子值、分母值)
    # Mapping to approximate English columns. Adjust if schema is strict chinese or specific names.
    # Assuming the user created tables with these English names or I should guess. 
    # USER PROMPT had Chinese descriptions. I'll use common english column names I'd expect.
    # If this fails, user sees 400 error and can adjust.
    
    # KPI Table Mapping
    kpi_upload = []
    for k in kpi_summary_list:
        kpi_upload.append({
            "department": k['department'],
            "doctor": k['doctor'],
            "indicator_name": k['indicator_name'],
            "indicator_def": k['indicator_def'],
            "numerator": k['numerator'],
            "denominator": k['denominator'],
            "value": k['value'],
            "unit": k['unit']
            # "hospital": k['hospital'] # If table has it
        })
    
    # KPI_Detail Table Mapping
    # (科別、指標名稱、指標公式、指標說明、指標類別、指標單位、指標類型、指標狀態、醫師、指標值，分子/分母值，病患個資(病患代碼、姓別、生日（年齡))
    detail_upload = []
    for d in KPI_DETAILS_BUFFER:
        detail_upload.append({
            "department": d['department'],
            "doctor": d['doctor'],
            "indicator_name": d['indicator_name'],
            "indicator_def": d['indicator_def'],
            # "formula": "...",
            # "category": "...",
            "unit": d['unit'],
            "status": d['status'], # 正常/異常
            "value": d['value'],
            "numerator": d['numerator'],
            "denominator": d['denominator'],
            "patient_id": d['patient_id'],
            "patient_gender": d['gender'],
            # "patient_age": ...,
            "report_date": d['timestamp'],
            "admission_date": d['admission_date'],
            "discharge_date": d['discharge_date'],
            "abnormal_reason": d['abnormal_reason']
        })

    upsert_supabase("KPI", kpi_upload)
    upsert_supabase("KPI_Detail", detail_upload)

if __name__ == "__main__":
    asyncio.run(main())