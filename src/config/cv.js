/*
 * ── CV（コンバージョン）定義 ──
 *
 * Tier1 CV = 資料請求(siryo) + 無料アカウント(free) の構成です。
 * key:   CSVのカラム名
 * label: 画面上の表示名
 *
 * カラムが追加された場合は、該当するグループに1行追加してください。
 * グループ自体を増やしたい場合は CONFIG_CV_GROUPS に追加します。
 */
const CONFIG_CV = {
  siryo: {
    label: "資料請求",
    color: "#F59E0B",
    totalKey: "total_siryo_cnt",
    keys: [
      { key: "generate_lead_ai_uu", label: "AI電話代行 資料DL" },
      { key: "generate_lead_0abj_uu", label: "電話自動応答 資料DL" },
      { key: "generate_lead_push_uu", label: "電話プッシュ 資料DL" },
      { key: "generate_lead_midep_uu", label: "MiDEP 資料DL" },
      { key: "cost_sim_complete_uu", label: "コストシミュ完了" },
      // ── 新しい資料請求CVはここに追加 ──
    ],
  },
  free: {
    label: "無料アカウント",
    color: "#10B981",
    totalKey: "total_free_acount_cnt",
    keys: [
      { key: "account_reg_ivr_uu", label: "無料アカウント(IVR)" },
      { key: "account_reg_ivr_num_uu", label: "無料アカウント(IVR番号)" },
      { key: "account_reg_none_uu", label: "無料アカウント(その他)" },
      // ── 新しい無料ACはここに追加 ──
    ],
  },
  other: {
    label: "その他",
    color: "#9CA3AF",
    keys: [
      { key: "generate_lead_aifax_uu", label: "AI FAX 資料DL" },
      { key: "generate_lead_democall_dl_uu", label: "デモコール DL" },
      { key: "account_reg_num_uu", label: "アカウント登録(番号)" },
      { key: "generate_lead_ivr_uu", label: "リード(IVR)" },
      { key: "generate_lead_ivr_num_uu", label: "リード(IVR番号)" },
      { key: "generate_lead_num_uu", label: "リード(番号)" },
      { key: "generate_lead_none_uu", label: "リード(その他)" },
      // ── 新しいその他CVはここに追加 ──
    ],
  },
};

export default CONFIG_CV;
