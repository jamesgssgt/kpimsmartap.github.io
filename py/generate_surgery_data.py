import asyncio
import random
import time
from datetime import datetime, timedelta
from fhirpy import AsyncFHIRClient
import urllib3

# 忽略 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# 設定參數
# ==========================================
FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"
DAYS_BACK = 180   
TOTAL_CASES = 300 # 增加案量以分配給三家醫院

# --- 定義三家醫院 (Organizations) ---
HOSPITALS = [
    {"code": "TP_GEN", "name": "台北綜合醫院", "risk_factor": 1.0}, # 標準風險
    {"code": "NAT_MED", "name": "國立醫學中心", "risk_factor": 1.2}, # 重症多，風險稍高
    {"code": "CITY_UN", "name": "市立聯合醫院", "risk_factor": 0.8}  # 社區型，風險稍低
]

# --- 定義科別與醫師模板 ---
# 程式會自動為每家醫院建立這些科別的「分身」
DEPT_TEMPLATE = {
    "SURG": {
        "name": "一般外科",
        "docs": ["劉", "張", "陳"], # 姓氏模板
        "procs": [
            {"code": "80146002", "display": "Laparoscopic appendectomy (腹腔鏡闌尾切除)"},
            {"code": "387713003", "display": "Cholecystectomy (膽囊切除術)"}
        ]
    },
    "CARDIO": {
        "name": "心臟內科",
        "docs": ["吳", "蔡", "楊"],
        "procs": [
            {"code": "415070008", "display": "PCI (心導管介入手術)"},
            {"code": "36969009", "display": "Stent placement (支架置放)"}
        ]
    },
    "ORTHO": {
        "name": "骨科部",
        "docs": ["王", "李", "趙"],
        "procs": [
            {"code": "274474001", "display": "TKR (全膝關節置換)"},
            {"code": "79659005", "display": "ORIF (骨折復位術)"}
        ]
    }
}

# --- 中文姓名產生器 ---
NAMES_MALE = ["志明", "俊傑", "建國", "家豪", "冠宇", "信宏", "志豪", "家偉", "文雄", "偉哲"]
NAMES_FEMALE = ["淑芬", "雅婷", "怡君", "美玲", "雅雯", "心怡", "美惠", "麗華", "秀英", "佩君"]

def generate_chinese_name(gender):
    # 隨機百家姓
    family = random.choice(list("李王張劉陳楊黃趙周吳徐孫馬朱胡林郭何高羅"))
    given = random.choice(NAMES_MALE) if gender == 'male' else random.choice(NAMES_FEMALE)
    return family, given

# --- ID 產生器 (1英文+11數字) ---
def get_long_id():
    prefix = random.choice(['A', 'B', 'H', 'K', 'M', 'T'])
    ts = str(int(time.time() * 1000000))[-7:]
    rand = str(random.randint(1000, 9999))
    return f"{prefix}{ts}{rand}"

async def create_infrastructure(client):
    """建立多醫院架構：醫院 -> 科別 -> 醫師"""
    print("🏥 正在建立三家醫院的組織架構...")
    infra = {}
    
    for hosp in HOSPITALS:
        h_code = hosp['code']
        infra[h_code] = {'risk': hosp['risk_factor'], 'depts': []}
        
        # 1. 建立「科別 Organizations」 (命名為：[醫院名] 科別名)
        # 這樣做可以讓 Encounter 直接綁定到該醫院的特定科別
        for d_code, d_info in DEPT_TEMPLATE.items():
            dept_org_id = get_long_id()
            full_dept_name = f"【{hosp['name']}】{d_info['name']}"
            
            org = client.resource('Organization', id=dept_org_id, name=full_dept_name, active=True)
            await org.save()
            
            # 2. 建立該科別的專屬醫師
            dept_docs = []
            for surname in d_info['docs']:
                doc_id = get_long_id()
                # 醫師名字加上醫院縮寫，方便識別 (ex: 劉醫師(TP))
                full_doc_name = f"{surname}醫師 ({hosp['name'][:2]})"
                
                prac = client.resource(
                    'Practitioner',
                    id=doc_id,
                    name=[{'text': full_doc_name}],
                    active=True
                )
                await prac.save()
                dept_docs.append(doc_id)
            
            infra[h_code]['depts'].append({
                'org_id': dept_org_id,
                'org_name': full_dept_name,
                'doctors': dept_docs,
                'procs': d_info['procs']
            })
            
    return infra

def calculate_risk(day_index, hospital_factor):
    """風險計算：基礎風險 * 醫院係數 + 波動"""
    base = 0.015
    fluctuation = 0
    # 模擬 2-3 個月前有一波全國性的流行病/異常
    if 60 < day_index < 90:
        fluctuation = 0.08
    
    noise = random.uniform(-0.005, 0.005)
    return max(0, (base * hospital_factor) + fluctuation + noise)

async def generate_case(client, infra, day_index, today):
    # 1. 隨機選醫院 (權重均等)
    hosp_code = random.choice(list(infra.keys()))
    hospital_data = infra[hosp_code]
    
    # 2. 隨機選科別與醫師
    dept = random.choice(hospital_data['depts'])
    doc_id = random.choice(dept['doctors'])
    proc_info = random.choice(dept['procs'])
    
    # 3. 時間與風險
    case_date = today - timedelta(days=day_index)
    op_start = case_date.replace(hour=random.randint(8, 16), minute=random.randint(0, 59))
    op_end = op_start + timedelta(minutes=random.randint(60, 240))
    
    # 計算是否發生不幸 (加入醫院係數)
    is_bad = random.random() < calculate_risk(day_index, hospital_data['risk'])
    
    death_date = None
    disposition = "home"
    if is_bad:
        event_time = op_end + timedelta(hours=random.randint(2, 46))
        if random.random() < 0.6:
            death_date = event_time
            disposition = "exp" # 死亡
            period_end = event_time
        else:
            disposition = "aadvice" # 病危出院
            period_end = event_time
    else:
        period_end = op_end + timedelta(days=random.randint(3, 8))
    
    # 4. 寫入資源 (一案一人，ID 唯一)
    pat_id = get_long_id()
    gender = random.choice(['male', 'female'])
    lname, fname = generate_chinese_name(gender)
    
    # Patient
    pat = client.resource('Patient', id=pat_id, gender=gender, name=[{'family': lname, 'given': [fname]}])
    if death_date: pat['deceasedDateTime'] = death_date.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    await pat.save()
    
    # Encounter (綁定到該醫院的科別 Organization)
    enc_id = get_long_id()
    enc = client.resource(
        'Encounter',
        id=enc_id,
        status='finished',
        class_={'system': 'http://terminology.hl7.org/CodeSystem/v3-ActCode', 'code': 'IMP'},
        subject={'reference': f"Patient/{pat_id}"},
        period={'start': (op_start-timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%S+00:00'), 
                'end': period_end.strftime('%Y-%m-%dT%H:%M:%S+00:00')},
        hospitalization={'dischargeDisposition': {'coding': [{'code': disposition}]}},
        serviceProvider={
            'reference': f"Organization/{dept['org_id']}",
            'display': dept['org_name'] # 直接存入名稱方便顯示
        }
    )
    await enc.save()
    
    # Procedure
    proc_id = get_long_id()
    proc = client.resource(
        'Procedure',
        id=proc_id,
        status='completed',
        subject={'reference': f"Patient/{pat_id}"},
        encounter={'reference': f"Encounter/{enc_id}"},
        performedPeriod={'start': op_start.strftime('%Y-%m-%dT%H:%M:%S+00:00'), 
                         'end': op_end.strftime('%Y-%m-%dT%H:%M:%S+00:00')},
        code={'coding': [{'system': 'http://snomed.info/sct', 'code': proc_info['code'], 'display': proc_info['display']}]},
        performer=[{'actor': {'reference': f"Practitioner/{doc_id}"}}]
    )
    await proc.save()
    
    return is_bad

async def main():
    print(f"🚀 開始生成多醫院擬真數據 (目標: {TOTAL_CASES} 筆)...")
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)
    
    infra = await create_infrastructure(client)
    print("✅ 三家醫院與科別架構建立完成")
    
    tasks = []
    today = datetime.now()
    bad_count = 0
    
    print("⏳ 正在寫入數據 (含姓名、醫院標籤、風險波動)...")
    
    for i in range(TOTAL_CASES):
        day_index = random.randint(0, DAYS_BACK)
        tasks.append(generate_case(client, infra, day_index, today))
        
    chunk_size = 20
    for i in range(0, len(tasks), chunk_size):
        chunk = tasks[i:i+chunk_size]
        results = await asyncio.gather(*chunk)
        bad_count += sum(results)
        print(f"\r   ...已完成 {min(i+chunk_size, TOTAL_CASES)}/{TOTAL_CASES}", end="", flush=True)
        
    print(f"\n🎉 完成！共產生 {TOTAL_CASES} 筆，異常案例 {bad_count} 筆")

if __name__ == "__main__":
    asyncio.run(main())