Attribute VB_Name = "GSTiQ_Macros"
'==============================================================================
' GSTiQ - VBA module for the ITC & RCM Working Model
' ICAI Advanced IT project
'
' HOW TO USE
'   1. Open excel\ITC_RCM_Working_Model.xlsx
'   2. Press Alt+F11 > File > Import File... > choose GSTiQ_Macros.bas
'   3. Save the workbook as "Excel Macro-Enabled Workbook (*.xlsm)"
'   4. Use the functions in any cell, e.g.  =GSTIN_VALID(D5)
'      Run macros from Developer > Macros (Alt+F8)
'
' USER-DEFINED FUNCTIONS
'   GSTIN_CHECKDIGIT(first14)          -> expected 15th character
'   GSTIN_VALID(gstin)                 -> TRUE / FALSE
'   GSTIN_STATE(gstin)                 -> state name from the state code
'   GST_FY(invoiceDate)                -> "2025-26"
'   SEC16_4_DEADLINE(invoiceDate)      -> 30 November after the FY ends
'   RCM_TOS(invDate, payDate, isGoods, [receiptDate]) -> time of supply u/s 12(3)/13(3)
'   RCM_DUE_DATE(tosDate)              -> 20th of the following month
'   INTEREST_SEC50(amount, fromDate, toDate, [rate]) -> simple interest, days/365
'   RULE42_D1(exemptTurnover, totalTurnover, commonCredit) -> amount to reverse
'
' MACROS
'   GSTiQ_HighlightRisks     - colours each register row by ITC status
'   GSTiQ_VendorLetters      - drafts follow-up letters for bills not in GSTR-2B
'   GSTiQ_ExportRegisterCSV  - saves the ITC Register as CSV next to the workbook
'   GSTiQ_ValidateAllGSTINs  - writes a validation message beside every GSTIN
'==============================================================================
Option Explicit

Private Const CHARSET As String = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
Private Const REG_SHEET As String = "ITC Register"
Private Const FIRST_ROW As Long = 5

'------------------------------------------------------------------------------
' GSTIN check digit: Luhn mod-36 over the first 14 characters
'------------------------------------------------------------------------------
Public Function GSTIN_CHECKDIGIT(ByVal first14 As String) As String
    Dim i As Integer, factor As Integer, total As Long, cp As Integer, addend As Long
    first14 = UCase$(Trim$(first14))
    If Len(first14) < 14 Then GSTIN_CHECKDIGIT = "": Exit Function
    factor = 2
    total = 0
    For i = 14 To 1 Step -1
        cp = InStr(1, CHARSET, Mid$(first14, i, 1)) - 1
        If cp < 0 Then GSTIN_CHECKDIGIT = "?": Exit Function
        addend = factor * cp
        If factor = 2 Then factor = 1 Else factor = 2
        total = total + (addend \ 36) + (addend Mod 36)
    Next i
    GSTIN_CHECKDIGIT = Mid$(CHARSET, ((36 - (total Mod 36)) Mod 36) + 1, 1)
End Function

Public Function GSTIN_VALID(ByVal gstin As String) As Boolean
    gstin = UCase$(Trim$(gstin))
    GSTIN_VALID = False
    If Len(gstin) <> 15 Then Exit Function
    If Not (gstin Like "##[A-Z][A-Z][A-Z][A-Z][A-Z]####[A-Z][1-9A-Z]Z[0-9A-Z]") Then Exit Function
    GSTIN_VALID = (GSTIN_CHECKDIGIT(Left$(gstin, 14)) = Right$(gstin, 1))
End Function

Public Function GSTIN_STATE(ByVal gstin As String) As String
    Dim code As String
    code = Left$(Trim$(gstin), 2)
    Select Case code
        Case "01": GSTIN_STATE = "Jammu & Kashmir"
        Case "02": GSTIN_STATE = "Himachal Pradesh"
        Case "03": GSTIN_STATE = "Punjab"
        Case "04": GSTIN_STATE = "Chandigarh"
        Case "05": GSTIN_STATE = "Uttarakhand"
        Case "06": GSTIN_STATE = "Haryana"
        Case "07": GSTIN_STATE = "Delhi"
        Case "08": GSTIN_STATE = "Rajasthan"
        Case "09": GSTIN_STATE = "Uttar Pradesh"
        Case "10": GSTIN_STATE = "Bihar"
        Case "19": GSTIN_STATE = "West Bengal"
        Case "21": GSTIN_STATE = "Odisha"
        Case "23": GSTIN_STATE = "Madhya Pradesh"
        Case "24": GSTIN_STATE = "Gujarat"
        Case "27": GSTIN_STATE = "Maharashtra"
        Case "29": GSTIN_STATE = "Karnataka"
        Case "30": GSTIN_STATE = "Goa"
        Case "32": GSTIN_STATE = "Kerala"
        Case "33": GSTIN_STATE = "Tamil Nadu"
        Case "36": GSTIN_STATE = "Telangana"
        Case "37": GSTIN_STATE = "Andhra Pradesh"
        Case "97": GSTIN_STATE = "Other Territory"
        Case Else: GSTIN_STATE = "State code " & code
    End Select
End Function

'------------------------------------------------------------------------------
' Dates and time limits
'------------------------------------------------------------------------------
Public Function GST_FY(ByVal invoiceDate As Date) As String
    Dim y As Integer
    If Month(invoiceDate) >= 4 Then y = Year(invoiceDate) Else y = Year(invoiceDate) - 1
    GST_FY = y & "-" & Right$(CStr(y + 1), 2)
End Function

Public Function SEC16_4_DEADLINE(ByVal invoiceDate As Date) As Date
    ' ITC cannot be taken after 30 November following the end of the FY (Sec 16(4))
    Dim y As Integer
    If Month(invoiceDate) >= 4 Then y = Year(invoiceDate) + 1 Else y = Year(invoiceDate)
    SEC16_4_DEADLINE = DateSerial(y, 11, 30)
End Function

Public Function RCM_TOS(ByVal invDate As Date, ByVal payDate As Variant, ByVal isGoods As Boolean, Optional ByVal receiptDate As Variant) As Date
    ' Goods  (Sec 12(3)): earliest of receipt, payment, 31st day after supplier invoice
    ' Service(Sec 13(3)): earlier of payment, 61st day after supplier invoice
    Dim t As Date
    If isGoods Then
        t = invDate + 30
        If Not IsMissing(receiptDate) Then If IsDate(receiptDate) Then If CDate(receiptDate) < t Then t = CDate(receiptDate)
    Else
        t = invDate + 60
    End If
    If IsDate(payDate) Then If CDate(payDate) < t Then t = CDate(payDate)
    RCM_TOS = t
End Function

Public Function RCM_DUE_DATE(ByVal tosDate As Date) As Date
    RCM_DUE_DATE = DateSerial(Year(tosDate), Month(tosDate) + 1, 20)
End Function

Public Function INTEREST_SEC50(ByVal amount As Double, ByVal fromDate As Date, ByVal toDate As Date, Optional ByVal rate As Double = 18) As Double
    Dim days As Long
    days = toDate - fromDate
    If days < 0 Then days = 0
    INTEREST_SEC50 = Round(amount * rate / 100 * days / 365, 2)
End Function

Public Function RULE42_D1(ByVal exemptTurnover As Double, ByVal totalTurnover As Double, ByVal commonCredit As Double) As Double
    If totalTurnover = 0 Then RULE42_D1 = 0 Else RULE42_D1 = Round(commonCredit * exemptTurnover / totalTurnover, 2)
End Function

'------------------------------------------------------------------------------
' Macros on the ITC Register (column Z = ITC status, D = GSTIN, C = supplier)
'------------------------------------------------------------------------------
Public Sub GSTiQ_HighlightRisks()
    Dim ws As Worksheet, r As Long, lastRow As Long, st As String
    Set ws = ThisWorkbook.Worksheets(REG_SHEET)
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    Application.ScreenUpdating = False
    For r = FIRST_ROW To lastRow
        st = CStr(ws.Cells(r, "Z").Value)
        With ws.Range(ws.Cells(r, "A"), ws.Cells(r, "AC")).Interior
            If Left$(st, 7) = "Blocked" Then
                .Color = RGB(251, 227, 225)
            ElseIf st = "Not in GSTR-2B" Or st = "Reverse - Rule 37" Or st = "Time-barred 16(4)" Then
                .Color = RGB(252, 239, 210)
            ElseIf st = "Eligible" Then
                .Color = RGB(225, 242, 232)
            Else
                .ColorIndex = xlNone
            End If
        End With
    Next r
    Application.ScreenUpdating = True
    MsgBox "Rows coloured by ITC status: red = blocked, amber = at risk, green = eligible.", vbInformation, "GSTiQ"
End Sub

Public Sub GSTiQ_ValidateAllGSTINs()
    Dim ws As Worksheet, r As Long, lastRow As Long, g As String, bad As Long
    Set ws = ThisWorkbook.Worksheets(REG_SHEET)
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    For r = FIRST_ROW To lastRow
        g = Trim$(CStr(ws.Cells(r, "D").Value))
        If g <> "" Then
            If Not GSTIN_VALID(g) Then
                bad = bad + 1
                ws.Cells(r, "D").AddComment "Invalid GSTIN - expected check digit " & GSTIN_CHECKDIGIT(Left$(g, 14))
            End If
        End If
    Next r
    MsgBox bad & " invalid GSTIN(s) found. See cell comments in column D.", vbInformation, "GSTiQ"
End Sub

Public Sub GSTiQ_VendorLetters()
    Dim ws As Worksheet, out As Worksheet, r As Long, lastRow As Long, o As Long
    Dim vendors As Object, k As Variant, txt As String
    Set ws = ThisWorkbook.Worksheets(REG_SHEET)
    Set vendors = CreateObject("Scripting.Dictionary")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    For r = FIRST_ROW To lastRow
        If ws.Cells(r, "Z").Value = "Not in GSTR-2B" Then
            k = ws.Cells(r, "C").Value & " (" & ws.Cells(r, "D").Value & ")"
            txt = "   - Invoice " & ws.Cells(r, "A").Value & " dated " & Format(ws.Cells(r, "B").Value, "dd-mmm-yyyy") & _
                  ", GST Rs " & Format(ws.Cells(r, "S").Value, "#,##0.00")
            If vendors.Exists(k) Then vendors(k) = vendors(k) & vbLf & txt Else vendors.Add k, txt
        End If
    Next r
    Application.DisplayAlerts = False
    On Error Resume Next
    ThisWorkbook.Worksheets("Vendor Letters").Delete
    On Error GoTo 0
    Application.DisplayAlerts = True
    Set out = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
    out.Name = "Vendor Letters"
    out.Columns("A").ColumnWidth = 110
    o = 1
    For Each k In vendors.Keys
        out.Cells(o, 1).Value = "To: " & k: out.Cells(o, 1).Font.Bold = True
        out.Cells(o + 1, 1).Value = "Subject: Invoices not reflected in our GSTR-2B"
        out.Cells(o + 2, 1).Value = "The following invoices are not visible in our GSTR-2B. Under Section 16(2)(aa) read with Rule 36(4) we cannot claim ITC until you report them in GSTR-1/IFF/GSTR-1A:"
        out.Cells(o + 3, 1).Value = vendors(k)
        out.Cells(o + 3, 1).WrapText = True
        out.Cells(o + 4, 1).Value = "Kindly upload them and confirm filing of GSTR-3B. Payment is on hold until then."
        o = o + 7
    Next k
    MsgBox vendors.Count & " letter(s) drafted on sheet 'Vendor Letters'.", vbInformation, "GSTiQ"
End Sub

Public Sub GSTiQ_ExportRegisterCSV()
    Dim path As String
    path = ThisWorkbook.Path & Application.PathSeparator & "ITC_Register_" & Format(Date, "yyyymmdd") & ".csv"
    ThisWorkbook.Worksheets(REG_SHEET).Copy
    ActiveWorkbook.SaveAs Filename:=path, FileFormat:=xlCSVUTF8
    ActiveWorkbook.Close SaveChanges:=False
    MsgBox "Register exported to " & path, vbInformation, "GSTiQ"
End Sub
