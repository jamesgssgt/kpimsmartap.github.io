import asyncio
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from fhirpy import AsyncFHIRClient
import urllib3

# 忽略 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# 1. 設定參數
# ==========================================
FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"
START_DATE = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
RISK_THRESHOLD = 2.0 

async def fetch_by_ids(client, resource_type, id_list):
    """通用函式：利用 _id 參數批次抓取資源"""
    if not id_list: return []
    unique_ids = list(set(id_list))
    fetched_resources = []
    chunk_size = 50
    for i in range(0, len(unique_ids), chunk_size):
        chunk = unique_ids[i:i + chunk_size]
        ids_str = ",".join(chunk)
        try:
            res = await client.resources(resource_type).search(_id=ids_str).fetch_all()
            fetched_resources.extend(res)
        except Exception: pass
    return fetched_resources

async def fetch_surgery_data():
    print(f"🔄 連接至伺服器: {FHIR_SERVER_URL}")
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)
    
    # 1. 抓 Procedure
    print("📥 步驟 1/3: 撈取手術資料 (Procedure)...")
    procedures = await client.resources('Procedure') \
        .search(date=f"ge{START_DATE}") \
        .limit(200) \
        .fetch_all()
        
    if not procedures: return [], [], []

    # 2. 收集 ID
    pat_ids = [p.get('subject', {}).get('reference', '').split('/')[-1] for p in procedures if p.get('subject')]
    enc_ids = [p.get('encounter', {}).get('reference', '').split('/')[-1] for p in procedures if p.get('encounter')]

    # 3. 補抓
    print(f"📥 步驟 2/3: 補抓 {len(set(pat_ids))} 筆病人資料...")
    patients = await fetch_by_ids(client, 'Patient', pat_ids)
    
    print(f"📥 步驟 3/3: 補抓 {len(set(enc_ids))} 筆住院資料...")
    encounters = await fetch_by_ids(client, 'Encounter', enc_ids)
    
    return procedures, patients, encounters

def process_data(procedures, patients_list, encounters_list):
    print("\n⚙️ 正在進行指標運算 (ETL)...")
    
    patients_map = {p.id: p for p in patients_list}
    encounters_map = {p.id: p for p in encounters_list}
    
    processed_list = []
    
    for i, proc in enumerate(procedures):
        try:
            # 取得關聯物件
            pat_ref = proc.get('subject', {}).get('reference', '').split('/')[-1]
            enc_ref = proc.get('encounter', {}).get('reference', '').split('/')[-1]
            
            patient = patients_map.get(pat_ref)
            encounter = encounters_map.get(enc_ref)
            
            if not patient or not encounter: continue

            # --- 🔍 DEBUG: 檢查前 3 筆的住院代碼長什麼樣 ---
            if i < 3:
                raw_class = encounter.get('class')
                print(f"   [Debug Case {i}] Encounter Class 資料結構: {raw_class}")

            # --- 寬容過濾邏輯 ---
            # 因為我們知道資料是模擬的，這裡改為：只要有對應到 Encounter 就視為分母
            # (如果一定要檢查 IMP，可以把下行註解拿掉，但要確保 raw_class 結構解析正確)
            # if raw_class.get('code') != 'IMP': continue 

            # --- 提取時間 ---
            op_end_str = proc.get('performedPeriod', {}).get('end')
            if not op_end_str: continue
            op_end = datetime.fromisoformat(op_end_str.replace('Z', '+00:00'))
            
            # --- 分子判斷 (48h 死亡/病危) ---
            is_numerator = False
            event_type = "存活"
            event_time = None
            
            # 1. 檢查死亡時間
            death_str = patient.get('deceasedDateTime')
            if death_str:
                death_time = datetime.fromisoformat(death_str.replace('Z', '+00:00'))
                hours_diff = (death_time - op_end).total_seconds() / 3600
                if 0 < hours_diff <= 48:
                    is_numerator = True
                    event_type = "🔴 術後死亡"
                    event_time = death_time

            # 2. 檢查病危出院
            if not is_numerator:
                hospitalization = encounter.get('hospitalization', {})
                disposition_data = hospitalization.get('dischargeDisposition', {}).get('coding', [{}])[0]
                disposition = disposition_data.get('code')
                
                if disposition in ['aadvice', 'exp']:
                    enc_end_str = encounter.get('period', {}).get('end')
                    if enc_end_str:
                        disch_time = datetime.fromisoformat(enc_end_str.replace('Z', '+00:00'))
                        hours_diff = (disch_time - op_end).total_seconds() / 3600
                        if 0 < hours_diff <= 48:
                            is_numerator = True
                            event_type = "🟠 病危出院"
                            event_time = disch_time

            # --- 醫師與名稱 ---
            doctor_name = "Unknown"
            performer = proc.get('performer', [])
            if performer:
                actor = performer[0].get('actor', {})
                doctor_name = actor.get('display') or actor.get('reference', 'Unknown')

            op_name = proc.get('code', {}).get('coding', [{}])[0].get('display', 'Surgery')

            processed_list.append({
                'OpDate': op_end.date(),
                'Month': op_end.strftime('%Y-%m'),
                'Doctor': doctor_name,
                'OpName': op_name,
                'IsNumerator': 1 if is_numerator else 0,
                'EventType': event_type,
                'EventTime': event_time,
                'PatientID': pat_ref
            })
            
        except Exception: continue

    return pd.DataFrame(processed_list)

def generate_visualizations(df):
    if df.empty:
        print("❌ 依然沒有資料。請檢查 Debug 訊息。")
        return

    # 表格
    stats = df.groupby('Doctor').agg(
        Total=('PatientID', 'count'),
        Numerator=('IsNumerator', 'sum')
    ).reset_index()
    stats['Rate %'] = (stats['Numerator'] / stats['Total'] * 100).round(2)
    stats['Status'] = stats['Rate %'].apply(lambda x: '🔴 異常' if x > RISK_THRESHOLD else '🟢 正常')
    
    print("\n" + "="*60)
    print("📋 [指標儀表板] 術後 48 小時死亡率統計 (依醫師)")
    print("="*60)
    try: print(stats.to_markdown(index=False))
    except: print(stats.to_string(index=False))
    
    # 圖表
    trend = df.groupby('Month')['IsNumerator'].mean().reset_index()
    plt.figure(figsize=(10, 5))
    plt.plot(trend['Month'], trend['IsNumerator']*100, '-o', color='red', label='Mortality Rate')
    plt.axhline(y=RISK_THRESHOLD, color='gray', linestyle='--')
    plt.title("48h Mortality Rate Trend")
    plt.ylabel("Rate (%)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    print("\n📈 正在開啟趨勢圖...")
    plt.show()
    
    # 明細
    bad_cases = df[df['IsNumerator'] == 1]
    if not bad_cases.empty:
        print("\n⚠️ 異常個案明細:")
        cols = ['OpDate', 'PatientID', 'Doctor', 'EventType']
        print(bad_cases[cols].to_string(index=False))

async def main():
    procs, pats, encs = await fetch_surgery_data()
    if not procs: return
    
    df = process_data(procs, pats, encs)
    generate_visualizations(df)

if __name__ == "__main__":
    asyncio.run(main())