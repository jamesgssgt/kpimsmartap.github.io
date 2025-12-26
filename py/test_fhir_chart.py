# 檔名: test_fhir_chart.py
import asyncio
from fhirpy import AsyncFHIRClient
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime

# ==========================================
# 👇 我已經幫您填入剛剛產生的正確 ID 了 👇
MY_PATIENT_ID = "3242755"
# ==========================================

FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"

async def main():
    print(f"🔄 連接至 Server...")
    print(f"🔍 正在讀取病人 ID: {MY_PATIENT_ID} 的 HbA1c 數據")
    
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)

    # 1. 查詢數據
    try:
        resources = client.resources('Observation') \
            .search(patient=MY_PATIENT_ID) \
            .search(code="http://loinc.org|4548-4") \
            .sort('date') # 依日期排序
            
        observations = await resources.fetch()
    except Exception as e:
        print(f"❌ 連線發生錯誤: {e}")
        return
    
    if not observations:
        print(f"❌ 找不到資料！請確認 gen_data.py 剛才是否真的顯示「寫入成功」。")
        return

    print(f"✅ 成功下載 {len(observations)} 筆數據，正在處理...")

    # 2. 資料清洗
    data = []
    for o in observations:
        try:
            # 取得日期
            raw_date = o.get('effectiveDateTime')
            if not raw_date: continue
            
            # 處理日期格式 (移除 Z 改為 +00:00 以符合 Python 格式)
            dt = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
            
            # 取得數值
            val = o.get('valueQuantity', {}).get('value')
            if val is None: continue

            data.append({'date': dt, 'value': float(val)})
        except Exception as e:
            # 略過格式錯誤的單筆資料
            pass

    if not data:
        print("⚠️ 有抓到 Observation，但數值解析失敗 (可能是格式問題)。")
        return

    # 3. 轉為 Pandas 並繪圖
    df = pd.DataFrame(data)
    
    # 確保按照時間排序
    df = df.sort_values(by='date')

    print(f"📊 準備繪圖 (共 {len(df)} 個點)...")

    plt.figure(figsize=(10, 6))
    
    # 畫折線
    plt.plot(df['date'], df['value'], color='#1976D2', alpha=0.6, label='HbA1c 趨勢')
    
    # 畫紅綠燈閾值線 (6.5%)
    THRESHOLD = 6.5
    plt.axhline(y=THRESHOLD, color='gray', linestyle='--', label=f'標準值 ({THRESHOLD}%)')
    
    # 畫紅綠燈點 (大於 6.5 為紅燈，小於為綠燈)
    colors = ['#D32F2F' if v > THRESHOLD else '#388E3C' for v in df['value']]
    plt.scatter(df['date'], df['value'], c=colors, s=50, zorder=5)

    plt.title(f"Patient {MY_PATIENT_ID} - HbA1c Analysis")
    plt.xlabel("Date")
    plt.ylabel("HbA1c (%)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # 自動調整日期顯示角度
    plt.gcf().autofmt_xdate()
    
    print("📈 圖表視窗已開啟！")
    plt.show()

if __name__ == "__main__":
    asyncio.run(main())