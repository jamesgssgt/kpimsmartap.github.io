# 預防性抗生素在手術劃刀前1小時內給予比率 (Prophylactic Antibiotic Administration Rate)

## 1. 指標定義 (Indicator Definition)

此指標旨在確保手術病患在劃刀前適當時間內獲得抗生素保護，以降低術後感染風險。

### 分母 (Denominator) - 手術母體
*   **對象**: 住院案件 (Encounter class = `IMP`)
*   **手術**: 符合特定手術代碼範圍 (ICD-10-PCS `00.30` ~ `86.99`)
*   **地點**: 在手術室執行 (Location type = `OR`, `CATH`, `SECT`)
*   **條件**: 必須有麻醉風險評估紀錄 (ASA Score `11368-0`)

### 排除條件 (Exclusions)
*   **剖腹產**: 排除 C-Section 手術 (Code in `C_Section_VS`)
*   **特殊藥物**: 排除 Vancomycin 或 Fluoroquinolones 類抗生素 (因給藥時間規範不同)
*   **治療性給藥**: 若術前病人已感染並正在接受抗生素治療 (Reason = `treatment` 且時間早於劃刀)，則不列入計算

### 分子 (Numerator) - 合格案件
*   **給藥時效**: 抗生素給藥時間 (`T_Admin`) 必須在 **劃刀時間 (`T_Inc`) 前 0 到 60 分鐘內**。
    *   **公式**: `0 < (T_Inc - T_Admin) <= 60 mins`
*   **狀態**: 給藥狀態必須為 `completed` 或 `in-progress`
*   **途徑**: 排除口服 (`PO`) 給藥 (除非是特定的大腸手術術前準備)

## 2. 系統執行作法 (Execution Flow)

系統採用 Smart on FHIR 架構，自動化執行以下流程：

### Step 1: 資料擷取 (Data Fetching)
*   系統定期從 FHIR Server 撈取 `Procedure` (手術資源)。
*   針對每筆符合分母條件的手術，透過 `subject` (病人) 與 `encounter` (住院代號) 關聯，查詢對應的 `MedicationAdministration` (給藥資源)。

### Step 2: 邏輯運算 (Calculation Engine)
*   **時間比對**: 系統自動提取 `Procedure.performedPeriod.start` (劃刀時間) 與 `MedicationAdministration.effectiveDateTime` (給藥時間)。
*   **區間判定**:
    *   計算 `T_Inc - T_Admin`。
    *   若落在 `[0, 60]` 分鐘區間內，且藥物種類正確、途徑非口服，標記為 **合格 (Numerator=1)**。
    *   否則標記為 **異常 (Numerator=0)**，並記錄原因 (例如：`未在劃刀前1小時內給藥`)。

### Step 3: 資料儲存與呈現 (Reporting)
*   **KPI 統計**: 計算達成率 = (合格人數 / 手術總人數) * 100%。目標設定為 >= 100%。

---

# 手術後 48 小時內死亡率 (Post-op Mortality Rate Within 48 Hours)

## 1. 指標定義 (Indicator Definition)

此指標旨在監測手術後短時間內的非預期死亡事件，以評估手術與麻醉照護品質。

### 分母 (Denominator) - 手術母體
*   **對象**: 住院案件 (Encounter class = `IMP`)
*   **手術**:
    *   類別為手術處置 (Category = `surgical`)
    *   狀態為已完成 (Status = `completed`)
    *   代碼符合 ICD-10-PCS 或 NHI 規範範圍
*   **地點**: 在手術室執行 (Location type = `OR`, `CATH`, `SECT`)
*   **條件**:
    *   必須有麻醉處置 (Procedure Category = `anesthesia`)
    *   必須有麻醉醫師參與 (Practitioner Role = `anesthesiologist`)
    *   必須有 ASA 麻醉風險評估 (Observation Code = `11368-0`)

### 排除條件 (Exclusions)
*   **器官捐贈**: 排除腦死接受器官摘除手術 (Code in `Organ_Harvest_VS`)

### 分子 (Numerator) - 死亡案件 (包含 AAD)
*   **術後死亡**: 病人在手術結束後 **48 小時內** 死亡 (Patient deceased = `true`)。
*   **院內死亡**: 住院期間死亡且時間落在術後 48 小時內 (Discharge Disposition = `exp`)。
*   **病危自動出院 (AAD)**: 病危自動出院視同死亡 (Discharge Disposition = `terminal` 或 `left-against-medical-advice`)。

## 2. 系統執行作法 (Execution Flow)

系統採用 Smart on FHIR 架構，自動化執行以下流程：

### Step 1: 資料擷取 (Data Fetching)
*   系統定期從 FHIR Server 撈取 `Procedure` (手術資源)。
*   檢查關聯的 `Encounter` (住院)、`Location` (地點)、`Practitioner` (人員) 與 `Observation` (ASA分數) 確保符合分母資格。

### Step 2: 邏輯運算 (Calculation Engine)
*   **時間比對**: 鎖定手術結束時間 (`Procedure.performedPeriod.end`) 為基準點 (T0)。
*   **狀態與時效查核**:
    *   查詢病患 `Patient.deceasedDateTime`。
    *   查詢 `Encounter.hospitalization.dischargeDisposition` 代碼。
    *   若死亡時間或出院(AAD)時間落在 `(T0, T0 + 48 hours]` 區間內，標記為 **異常 (Numerator=1)**。
    *   否則標記為 **正常 (Numerator=0)**。

### Step 3: 資料儲存與呈現 (Reporting)
*   **KPI 統計**: 計算異常率 = (死亡與AAD人數 / 手術總人數) * 100%。目標設定為 <= 1.0% (依院內政策調整)。
*   **異常明細**: 系統自動生成異常清單，包含病歷號、手術名稱、手術時間、死亡時間等，供品質會議檢討。

