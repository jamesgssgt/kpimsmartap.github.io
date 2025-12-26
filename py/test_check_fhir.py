import asyncio
import random
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime, timedelta
from fhirpy import AsyncFHIRClient
import urllib3

# 忽略 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# 👇 鎖定您查到的正確 ID
TARGET_PATIENT_ID = "3242755"
# ==========================================

FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"

async def main():
    print(f"🔄 連接至伺服器，鎖定病人 ID: {TARGET_PATIENT_ID}")
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)

    # -------------------------------------------------------
    # 步驟 1: 檢查是否有數據
    # -------------------------------------------------------
    print("🔍 正在檢查該病人現有的 HbA1c 數據...")
    
    # 查詢該病人的 HbA1c
    resources = client.resources('Observation') \
        .search(patient=TARGET_PATIENT_ID) \
        .search(code="http://loinc.org|4548-4") \
        .sort('-date')
    
    observations = await resources.fetch()
    
    print(f"📋 目前資料庫中找到: {len(observations)} 筆數據")

    # -------------------------------------------------------
    # 步驟 2: 如果沒數據，自動補寫 (Auto-Fill)
    # -------------------------------------------------------
    if len(observations) == 0:
        print("\n⚠️ 發現該病人只有基本資料，沒有檢驗數據！")
        print("💉 正在為他『補寫』50 筆模擬數據，請稍候...")
        
        new_obs_list = []
        base_date = datetime.now()
        
        for i in range(50):
            # 模擬每週一次
            date_str = (base_date - timedelta(weeks=i)).strftime('%Y-%m-%dT%H:%M:%S+00:00')
            # 模擬數值 (5.5 ~ 9.5)
            val = round(7.5 + random.uniform(-2.0, 2.0), 1)
            
            obs = client.resource(
                'Observation',
                status='final',
                code={'coding': [{'system': 'http://loinc.org', 'code': '4548-4', 'display': 'HbA1c'}]},
                subject={'reference': f'Patient/{TARGET_PATIENT_ID}'}, # 綁定 ID
                effectiveDateTime=date_str,
                valueQuantity={'value': val, 'unit': '%', 'system': 'http://unitsofmeasure.org', 'code': '%'}
            )
            new_obs_list.append(obs)

        # 批次寫入
        chunk_size = 10
        for i in range(0, len(new_obs_list), chunk_size):
            chunk = new_obs_list[i:i + chunk_size]
            await asyncio.gather(*[o.save() for o in chunk])
            print(f"   ...已寫入 {min(i+chunk_size, 50)}/50 筆")
            
        print("✅ 數據補寫完成！")
        
        # 重新抓取一次 (這時候通常因為索引延遲可能還抓不到，所以我們直接用記憶體裡的資料來畫圖)
        observations = new_obs_list # 為了讓當下能畫圖，直接用剛生成的物件
        print("⚡ 使用剛生成的數據進行繪圖 (避開伺服器索引延遲)")

    # -------------------------------------------------------
    # 步驟 3: 資料清洗與繪圖
    # -------------------------------------------------------
    data = []
    for o in observations:
        try:
            # 兼容兩種來源：從伺服器抓下來的(dict) vs 剛建立的物件(resource object)
            if isinstance(o, dict):
                raw_date = o.get('effectiveDateTime')
                val = o.get('valueQuantity', {}).get('value')
            else:
                raw_date = o.effectiveDateTime
                val = o.valueQuantity['value']

            if raw_date and val:
                dt = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
                data.append({'date': dt, 'value': float(val)})
        except Exception: pass

    if not data:
        print("❌ 無法解析數據。")
        return

    df = pd.DataFrame(data).sort_values('date')

    print(f"\n📊 準備繪圖 (共 {len(df)} 點)...")
    plt.figure(figsize=(10, 6))
    plt.plot(df['date'], df['value'], '-o', color='#2196F3', label='HbA1c')
    
    # 紅綠燈閾值
    plt.axhline(y=6.5, color='gray', linestyle='--', label='Threshold (6.5%)')
    
    # 著色
    colors = ['#F44336' if v > 6.5 else '#4CAF50' for v in df['value']]
    plt.scatter(df['date'], df['value'], c=colors, s=80, zorder=5)

    plt.title(f"Patient {TARGET_PATIENT_ID} - HbA1c Trend")
    plt.xlabel("Date")
    plt.ylabel("HbA1c (%)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.gcf().autofmt_xdate()
    
    print("📈 圖表視窗已開啟！")
    plt.show()

if __name__ == "__main__":
    asyncio.run(main())