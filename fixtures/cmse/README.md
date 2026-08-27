# CMSE 抓取样本

用于回归解析逻辑；**不是**伪造的实时数据。

| 文件 | 来源 |
| --- | --- |
| `orbit-list.sample.html` | 保存自 https://www.cmse.gov.cn/gfgg/zgkjzgdcs/ |
| `CSS_OEM_20260821004850_0001.dat` | 同页 ZIP 解压得到的 OEM |
| `zhxw-list.sample.html` | 保存自 https://www.cmse.gov.cn/xwzx/zhxw/ |

若官网 HTML 结构变化导致 `scripts/fetch-cmse-oem.mjs` 解析失败，请更新样本并修正选择器，勿手写假星历。
