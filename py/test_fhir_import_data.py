# 檔名: gen_data.py
import asyncio
import random
from datetime import datetime, timedelta
from fhirpy import AsyncFHIRClient

# SMART Launcher 公開伺服器
FHIR_SERVER_URL = "https://launch.smarthealthit.org/v/r4/fhir"

async def main():
    print(f"🚀 連接至: {FHIR_SERVER_URL}")
    client = AsyncFHIRClient(url=FHIR_SERVER_URL)

    # 1. 建立病人
    print("👤 正在建立測試病人...")
    try:
        p = client.resource('Patient', name=[{'family': 'Test', 'given': ['MyDemo']}])
        await p.save()
        pid = p.id
        print(f"✅ 病人建立成功！ID: {pid}")
    except Exception as e:
        print(f"❌ 建立失敗: {e}")
        return

    # 2. 準備 100 筆 HbA1c 數據
    print("📦 準備生成 100 筆數據...")
    observations = []
    base_date = datetime.now()
    
    for i in range(100):
        # 日期遞減 (每週一筆)
        date_str = (base_date - timedelta(weeks=i)).strftime('%Y-%m-%dT%H:%M:%S+00:00')
        
        # 數值波動模擬 (5.0 ~ 9.0)
        val = round(6.0 + random.uniform(-1.0, 3.0), 1)
        
        obs = client.resource(
            'Observation',
            status='final',
            code={'coding': [{'system': 'http://loinc.org', 'code': '4548-4'}]}, # HbA1c
            subject={'reference': f'Patient/{pid}'},
            effectiveDateTime=date_str,
            valueQuantity={'value': val, 'unit': '%', 'code': '%'}
        )
        observations.append(obs)

    # 3. 批次寫入
    print("📤 開始上傳數據 (請稍候)...")
    # 分批上傳以免 timeout
    chunk_size = 20
    for i in range(0, len(observations), chunk_size):
        chunk = observations[i:i + chunk_size]
        await asyncio.gather(*[o.save() for o in chunk])
        print(f"   已寫入 {min(i + chunk_size, 100)}/100 筆")

    print("\n" + "="*40)
    print(f"🎉 資料生成完畢！請複製下方的 Patient ID")
    print(f"Patient ID: {pid}")
    print("="*40)

if __name__ == "__main__":
    asyncio.run(main())