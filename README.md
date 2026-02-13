# ERP PRO — GOLDEN V12
بدون ضرائب / بدون تصنيع

## إضافات V12
- طباعة فاتورة A4 بتفاصيل الأسطر (اضغط على الفاتورة من القائمة).
- ترحيل المناقلات والتسويات إلى INV_LEDGER.
- شاشة رصيد مخزون + حركة مخزون.
- صلاحيات + Audit Log.

## التشغيل
- ارفع ملفات GitHub في الجذر (بدون مجلدات).
- حدّث Apps Script بـ V12 ثم Deploy (Update deployment).

API URL مضبوط على:
https://script.google.com/macros/s/AKfycbwgVIBcLOTUM1MRfc5zOVuxjuun8QJAjsolWwZDVRD7XjtKWqvoca879pstV-OUC-Yu/exec


## Fix Failed to fetch
- Frontend uses POST بدون headers لتجنب CORS preflight.
- Apps Script: Execute as Me + Access Anyone.
