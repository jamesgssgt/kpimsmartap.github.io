# 手術照護指標作業方式詳細說明 (Detailed Operation Guide for Surgical Care Indicators)

本文檔詳細說明「手術後 48 小時內死亡率」及「預防性抗生素在手術劃刀前1小時內給予比率」的作業定義、邏輯與 FHIR 實作細節。

---

## 1. 手術後 48 小時內死亡率 (Mortality within 48 hours after surgery)

### **預期目標**
降低手術後短期內發生死亡的比率，監測與提升手術安全性。

### **目標值 (Target)**
*   **系統設定值**: < 1.5%
*   **院內政策目標**: <= 1.0%

### **指標詳細定義**

#### **其中：分子 (Numerator)**
*   **定義**：同分母病人中，於手術後 48 小時內死亡者。
*   **資料來源 (Source)**：
    *   **FHIR 資源**: `Patient`
    *   **判斷欄位**: `deceasedDateTime` (死亡時間)
*   **計算邏輯 (Logic)**：
    1.  找到手術案件對應的 `Patient`。
    2.  若 `Patient.deceasedBoolean` 為 `true` 或存在 `deceasedDateTime`。
    3.  計算 **死亡時間間隔** = `Patient.deceasedDateTime` - `Procedure.performedPeriod.end` (手術結束時間)。
    4.  **符合條件**：`0 < 死亡時間間隔 <= 48 小時`。

#### **分母 (Denominator)**
*   **定義**：手術總人次（排除特定手術）。
*   **資料來源 (Source)**：
    *   **FHIR 資源**: `Procedure` (手術), `Encounter` (就診)
*   **計算邏輯 (Logic)**：
    1.  **納入條件 (Inclusion)**：
        *   **住院案件**: `Encounter.class = 'IMP'` (Inpatient)。
        *   **手術代碼**: `Procedure.code` 位於 ICD-10-PCS `00.30-86.99` 範圍內 (參考值集: `PCS_Surgery_VS`)。
        *   **手術處置 (Surgical)**:
            *   `Procedure.category` (使用代碼比對) = `surgical`
            *   `Procedure.status` = `completed`
        *   **執行地點**: `Procedure.location` 需為手術室 (OR/CATH/SECT)。
    2.  **排除條件 (Exclusions)**：
        *   **剖腹產**: `Procedure.code` 屬於 `C_Section_Exclusion_VS` (如 ICD-9 74.x 等轉換碼)。
        *   **器官摘除 (Organ Harvest)**: 排除腦死器官捐贈之摘除手術。
            *   **排除原因**: 手術病患為腦死器官捐贈者，其預期結果即為死亡，不應計入「手術後非預期死亡」之品質監測。
            *   **定義 (Organ_Harvest_VS)**:
                *   `68035B`: 屍體腎臟摘取術
                *   `68037B`: 活體腎臟摘取術
                *   `68048B`: 腹腔鏡活體腎臟摘取術
                *   `75020B`: 屍體多種器官摘取術
                *   `75021B`: 心臟摘取術
                *   `75022B`: 肺臟摘取術
                *   `75023B`: 肝臟摘取術
                *   `75024B`: 胰臟摘取術
                *   `75025B`: 小腸摘取術

### **測試案例 (Test Scenario)**
*   **情境 1 (符合分子)**: 病人 A 於 1/1 10:00 結束手術，於 1/2 10:00 死亡 (間隔 24h) -> **計入**。
*   **情境 2 (不符合分子)**: 病人 B 於 1/1 10:00 結束手術，於 1/4 10:00 死亡 (間隔 72h) -> **不計入**。
*   **情境 3 (排除分母)**: 病人 C 進行剖腹產手術 -> **直接排除**。

---

## 2. 預防性抗生素在手術劃刀前1小時內給予比率 (Prophylactic antibiotic administration rate)

### **預期目標**
確保手術前適時給予預防性抗生素，以降低手術部位感染 (SSI) 風險。

### **指標詳細定義**

#### **其中：分子 (Numerator)**
*   **定義**：同分母病人中，於手術劃刀前 1 小時內 (0-60分鐘) 接受預防性抗生素給藥者。
*   **資料來源 (Source)**：
    *   **FHIR 資源**: `MedicationAdministration` (給藥紀錄)
*   **計算邏輯 (Logic)**：
    1.  **給藥目的**: `MedicationAdministration.reasonCode` 為 `prophylaxis` (預防性) 或透過藥物代碼識別。
    2.  **時效判定**: 計算 `Procedure.performedPeriod.start` (劃刀時間 T_Inc) - `MedicationAdministration.effectiveDateTime` (給藥時間 T_Admin)。
    3.  **符合條件**: `0 < (T_Inc - T_Admin) <= 60 分鐘`。
    4.  **給藥狀態**: `status` 必須為 `completed` 或 `in-progress`。
    5.  **途徑篩選**: `dosage.route` **不應**為 `PO` (口服)，除非是結直腸手術的腸道準備 (Bowel Prep)。

#### **分母 (Denominator)**
*   **定義**：符合預防性抗生素給藥適應症的手術人次。
*   **資料來源 (Source)**：
    *   **FHIR 資源**: `Procedure`, `Observation` (ASA), `Encounter`
*   **計算邏輯 (Logic)**：
    1.  **納入條件 (Inclusion)**：
        *   **住院案件**: `Encounter.class = 'IMP'`。
        *   **主要手術**: `Procedure.code` 位於 `PCS_Surgery_VS` (00.30-86.99)。
        *   **麻醉分級 (ASA)**: 需有 `Observation` 紀錄 (LOINC `11368-0`)，值為 1-5 級。
        *   **執行地點**: 手術室 (`OR`, `CATH`, `SECT`)。
    2.  **排除條件 (Exclusions)**：
        *   **剖腹產**: `Procedure.code` 屬於 `C_Section_VS`。
        *   **治療性抗生素**: 若手術前已因感染給予治療性 (`reasonCode=treatment`) 抗生素，則不需再預防給藥 -> **排除**。
        *   **特殊藥物**: 若使用 **Vancomycin** 或 **Fluoroquinolones** (需 2 小時前給藥)，不適用 1 小時指標 -> **排除** (這類通常歸於另一指標)。

### **資料欄位對應 (Mapping)**
| 欄位名稱 | FHIR 路徑 | 說明 |
| :--- | :--- | :--- |
| 病歷號 | `Patient.identifier` | 病患唯一識別 |
| 手術劃刀時間 (T_Inc) | `Procedure.performedPeriod.start` | 手術開始時間 |
| 給藥時間 (T_Admin) | `MedicationAdministration.effectiveDateTime` | 實際給藥時間 |
| 藥物代碼 | `MedicationAdministration.medicationCodeableConcept` | 識別是否為抗生素 |
| 手術名稱 | `Procedure.code.text` | 手術名稱描述 |

### **測試案例 (Test Scenario)**
*   **情境 1 (符合分子)**:
    *   手術 09:00 劃刀。
    *   Cefazolin 於 08:30 給藥 (前 30 分鐘)。
    *   **結果**: 符合 <= 60 分鐘 -> **計入分子**。
*   **情境 2 (不符合分子 - 逾時)**:
    *   手術 09:00 劃刀。
    *   Cefazolin 於 07:50 給藥 (前 70 分鐘)。
    *   **結果**: 超過 60 分鐘 -> **不計入分子**。
*   **情境 3 (排除 - 治療性使用)**:
    *   病患因蜂窩性組織炎，術前已在打抗生素 (`reason=treatment`)。
    *   **結果**: 符合排除條件 -> **不計入分母**。

---

## 3. 資料正確性驗證方式 (Data Verification Methods)

建議使用以下兩種方式驗證指標計算的正確性：

### **方法 A: SQL 直接查詢驗證 (Direct SQL Verification)**

您可以直接在 Supabase SQL Editor 中執行以下查詢，核對資料庫中的原始數據是否符合預期。

#### **1. 驗證「手術後 48 小時內死亡率」**

```sql
-- 查詢分子: 手術後 48 小時內死亡的名單
SELECT 
    p.subject->>'reference' as patient_id,
    proc.performed_period_end as surgery_end_time,
    p.deceased_datetime as death_time,
    EXTRACT(EPOCH FROM (p.deceased_datetime - proc.performed_period_end))/3600 as hours_diff
FROM "MeasureReport" mr -- 假設來源表，實際請替換為您的 Procedure/Patient 表
JOIN "Patient" p ON p.id = mr.subject_id
JOIN "Procedure" proc ON proc.subject_id = p.id
WHERE 
    -- 納入條件
    proc.code IN (SELECT code FROM "ValueSet_Codes" WHERE set_id = 'PCS_Surgery_VS') 
    AND
    -- 分子條件: 死亡時間在手術結束後 48 小時內
    p.deceased_datetime IS NOT NULL 
    AND p.deceased_datetime > proc.performed_period_end
    AND p.deceased_datetime <= (proc.performed_period_end + INTERVAL '48 hours');
```

#### **2. 驗證「預防性抗生素給予比率」**

```sql
-- 查詢分子: 劃刀前 60 分鐘內給藥的名單
SELECT 
    proc.subject->>'reference' as patient_id,
    proc.performed_period_start as incision_time,
    med.effective_datetime as admin_time,
    med.medication_code,
    EXTRACT(EPOCH FROM (proc.performed_period_start - med.effective_datetime))/60 as mins_before
FROM "Procedure" proc
JOIN "MedicationAdministration" med ON med.subject_id = proc.subject_id
WHERE 
    -- 分母條件
    proc.code IN (SELECT code FROM "ValueSet_Codes" WHERE set_id = 'PCS_Surgery_VS')
    AND
    -- 分子條件: 給藥在劃刀前 0-60 分鐘
    med.effective_datetime < proc.performed_period_start
    AND med.effective_datetime >= (proc.performed_period_start - INTERVAL '60 minutes')
    -- 排除條件: 非口服
    AND (med.dosage_route IS NULL OR med.dosage_route != 'PO');
```

---

### **方法 B: 建立測試數據驗證 (Manual Test Data Verification)**

若無法直接查詢資料庫，可透過手動建立測試資料來驗證應用程式邏輯。

#### **步驟 1: 建立基礎資料**
1.  建立一位測試病患 (Patient): `Test-Patient-001`。
2.  建立一次就診 (Encounter): `Test-Enc-001`，類別設為 `IMP` (住院)。

#### **步驟 2: 模擬情境 (以預防性抗生素為例)**
1.  **建立手術 (Procedure)**:
    *   代碼: `00.30` (符合手術值集)。
    *   劃刀時間 (Start): `2024-01-01T10:00:00Z`。
2.  **建立給藥 (MedicationAdministration)**:
    *   藥物: Cefazolin。
    *   給藥時間 (Effective): `2024-01-01T09:30:00Z` (術前 30 分鐘)。
    *   狀態: `completed`。

#### **步驟 3: 執行指標計算**
1.  至系統指標頁面，點選「重新計算」或「同步資料」。
2.  檢查該指標的分子數是否 +1。

#### **步驟 4: 測試邊界與排除**
1.  修改 **給藥時間** 為 `08:59:00Z` (術前 61 分鐘)。
2.  重新計算 -> 分子數應不變 (或 -1)。
3.  修改 **給藥途徑** 為 `PO`。
4.  重新計算 -> 分子數應不變 (或 -1)。

---

### **方法 C: FHIR 資料同步驗證 (FHIR Sync Verification)**

此方法驗證從 FHIR Server 抓取資料到本地計算的完整流程。

#### **步驟 1: 確認 FHIR 來源資料**
系統預設連接至 `https://launch.smarthealthit.org/v/r4/fhir`。您可以使用 Postman 或瀏覽器查詢該伺服器，確認是否有符合條件的資料。

*   **查詢手術 (Procedure)**:
    `https://launch.smarthealthit.org/v/r4/fhir/Procedure?code=00.30&_count=10`
*   **查詢給藥 (MedicationAdministration)**:
    `https://launch.smarthealthit.org/v/r4/fhir/MedicationAdministration?status=completed&_count=10`

#### **步驟 2: 觸發同步 (Trigger Sync)**
1.  登入系統。
2.  進入「指標管理」或「資料同步」頁面。
3.  點擊 **「同步 FHIR Server」** (Sync Data) 按鈕。
4.  等待系統提示「同步成功」。

#### **步驟 3: 驗證計算結果 (Verify Result)**
同步完成後，檢查 `KPI_Detail` 表中的 `fhir_source` 欄位或觀察 UI 報表。

```sql
-- 檢查是否有從 FHIR 同步進來的異常資料
SELECT * FROM "KPI_Detail"
WHERE indicator_name LIKE '%抗生素%'
AND report_date >= NOW() - INTERVAL '1 day';
```

若 `KPI_Detail` 有資料且 `status` 判斷正確，即代表 FHIR 資料擷取與運算邏輯運作正常。


