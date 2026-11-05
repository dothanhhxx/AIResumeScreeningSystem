# -*- coding: utf-8 -*-
"""
Generator for BO_CAU_HOI_VA_TRA_LOI_PHAN_BIEN_TALENTLENS.docx
Contains 25 deep, rigorous academic defense questions with:
- Bản chất câu hỏi (Thầy đang bắt bẻ điều gì)
- Câu trả lời chuẩn mực bám sát mã nguồn
- Dẫn chứng file / code cụ thể
- Thái độ học thuật & giải pháp nâng cấp
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

from qa_data import QA_DATA

def set_cell_background(cell, color_hex):
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_code_block(doc, code_text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.cell(0, 0)
    set_cell_background(cell, "F4F6F9")
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
    
    borders_xml = f'''
    <w:tcBorders {nsdecls("w")}>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>
        <w:left w:val="single" w:sz="18" w:space="0" w:color="1B365D"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="D0D7DE"/>
    </w:tcBorders>
    '''
    cell._tc.get_or_add_tcPr().append(parse_xml(borders_xml))
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_text.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(34, 34, 34)
    
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(3)

def add_callout_box(doc, title, text, box_type="info"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.cell(0, 0)
    colors = {
        "info": ("EBF3FB", "1B365D"),
        "tip": ("EAF7ED", "1A7F37"),
        "warning": ("FFF8C5", "9A6700"),
        "important": ("FDE8E8", "CF222E")
    }
    bg_color, border_color = colors.get(box_type, ("EBF3FB", "1B365D"))
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    borders_xml = f'''
    <w:tcBorders {nsdecls("w")}>
        <w:top w:val="none"/>
        <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
    </w:tcBorders>
    '''
    cell._tc.get_or_add_tcPr().append(parse_xml(borders_xml))
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    prefix = {"info": "📌", "tip": "💡 Chiến lược phản biện:", "warning": "⚠️ Điểm cần lưu ý:", "important": "🎯 Nguyên tắc vàng:"}.get(box_type, "📌")
    run_title = p.add_run(f"{prefix} {title}\n")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(10)
    run_title.font.bold = True
    r_val = int(border_color[0:2], 16)
    g_val = int(border_color[2:4], 16)
    b_val = int(border_color[4:6], 16)
    run_title.font.color.rgb = RGBColor(r_val, g_val, b_val)
    
    run_text = p.add_run(text)
    run_text.font.name = "Arial"
    run_text.font.size = Pt(9.5)
    run_text.font.color.rgb = RGBColor(50, 50, 50)
    
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(3)

def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(22)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor(27, 54, 93)
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = RGBColor(51, 102, 153)
    return p

def add_qa_card(doc, num_str, question, nature, answer, code_evidence, solution):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.cell(0, 0)
    set_cell_background(cell, "FFFFFF")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    
    borders_xml = f'''
    <w:tcBorders {nsdecls("w")}>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="D0D7DE"/>
        <w:left w:val="single" w:sz="24" w:space="0" w:color="1B365D"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="D0D7DE"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="D0D7DE"/>
    </w:tcBorders>
    '''
    cell._tc.get_or_add_tcPr().append(parse_xml(borders_xml))
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    
    # 1. Question Title
    rq_num = p.add_run(f"❓ {num_str}: ")
    rq_num.font.name = "Arial"
    rq_num.font.size = Pt(10.5)
    rq_num.font.bold = True
    rq_num.font.color.rgb = RGBColor(180, 40, 40)
    
    rq_text = p.add_run(f"{question}\n\n")
    rq_text.font.name = "Arial"
    rq_text.font.size = Pt(10)
    rq_text.font.bold = True
    rq_text.font.color.rgb = RGBColor(27, 54, 93)
    
    # 2. Bản chất câu hỏi
    p_nat = p.add_run("🎯 Bản chất câu hỏi (Thầy đang bắt bẻ điều gì?):\n")
    p_nat.font.name = "Arial"
    p_nat.font.size = Pt(9.5)
    p_nat.font.bold = True
    p_nat.font.color.rgb = RGBColor(190, 90, 0)
    
    r_nat_val = p.add_run(f"{nature}\n\n")
    r_nat_val.font.name = "Arial"
    r_nat_val.font.size = Pt(9)
    r_nat_val.font.italic = True
    r_nat_val.font.color.rgb = RGBColor(80, 80, 80)
    
    # 3. Câu trả lời chuẩn mực
    p_ans = p.add_run("💬 Chiến lược trả lời chuẩn mực điểm 10:\n")
    p_ans.font.name = "Arial"
    p_ans.font.size = Pt(9.5)
    p_ans.font.bold = True
    p_ans.font.color.rgb = RGBColor(20, 120, 40)
    
    r_ans_val = p.add_run(f"{answer}\n\n")
    r_ans_val.font.name = "Arial"
    r_ans_val.font.size = Pt(9.5)
    r_ans_val.font.color.rgb = RGBColor(30, 30, 30)
    
    # 4. Minh chứng mã nguồn
    p_code = p.add_run("📂 Dẫn chứng mã nguồn chính xác:\n")
    p_code.font.name = "Arial"
    p_code.font.size = Pt(9.5)
    p_code.font.bold = True
    p_code.font.color.rgb = RGBColor(51, 102, 153)
    
    r_code_val = p.add_run(f"{code_evidence}\n\n")
    r_code_val.font.name = "Consolas"
    r_code_val.font.size = Pt(8.5)
    r_code_val.font.color.rgb = RGBColor(160, 40, 40)
    
    # 5. Thừa nhận học thuật & Nâng cấp
    p_upg = p.add_run("💡 Thừa nhận học thuật & Hướng nâng cấp:\n")
    p_upg.font.name = "Arial"
    p_upg.font.size = Pt(9.5)
    p_upg.font.bold = True
    p_upg.font.color.rgb = RGBColor(110, 40, 140)
    
    r_upg_val = p.add_run(f"{solution}")
    r_upg_val.font.name = "Arial"
    r_upg_val.font.size = Pt(9)
    r_upg_val.font.color.rgb = RGBColor(50, 50, 50)
    
    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(4)

def generate_qa_document():
    doc = docx.Document()
    
    # Page setup - Margins 1 inch
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.different_first_page_header_footer = True
        
        # Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("TalentLens — Tuyển Tập 25 Câu Hỏi & Chiến Lược Trả Lời Phản Biện Điểm 10")
        hrun.font.name = "Arial"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(128, 128, 128)
        
        # Footer
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("Tài Liệu Bảo Vệ Đồ Án Tốt Nghiệp — Chuyên Ngành Kỹ Thuật Phần Mềm & Trí Tuệ Nhân Tạo")
        frun.font.name = "Arial"
        frun.font.size = Pt(8)
        frun.font.color.rgb = RGBColor(140, 140, 140)

    # Styles Setup
    styles = doc.styles
    normal_style = styles['Normal']
    normal_style.font.name = 'Arial'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(34, 34, 34)
    normal_style.paragraph_format.line_spacing = 1.2
    normal_style.paragraph_format.space_after = Pt(4)

    # ==========================================
    # TRANG BÌA (COVER PAGE)
    # ==========================================
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_before = Pt(36)
    p_inst.paragraph_format.space_after = Pt(4)
    r = p_inst.add_run("HỘI ĐỒNG BẢO VỆ ĐỒ ÁN TỐT NGHIỆP / BÁO CÁO DỰ ÁN\nKHOA CÔNG NGHỆ THÔNG TIN")
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.bold = True
    r.font.color.rgb = RGBColor(27, 54, 93)

    p_line = doc.add_paragraph()
    p_line.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_line.paragraph_format.space_after = Pt(30)
    r_line = p_line.add_run("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    r_line.font.color.rgb = RGBColor(51, 102, 153)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(20)
    p_title.paragraph_format.space_after = Pt(12)
    r_title = p_title.add_run("TUYỂN TẬP 25 CÂU HỎI PHẢN BIỆN CHUYÊN SÂU\nVÀ CHIẾN LƯỢC TRẢ LỜI ĐẠT ĐIỂM 10 TUYỆT ĐỐI\nDỰ ÁN: TALENTLENS — AI RESUME SCREENING & EXPLAINABLE RANKING SYSTEM")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(15)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(27, 54, 93)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(60)
    r_sub = p_sub.add_run("Phân Tích Bản Chất Câu Hỏi · Chiến Lược Trả Lời Trọng Tâm · Dẫn Chứng Mã Nguồn Chi Tiết\nThừa Nhận Học Thuật & Đề Xuất Nâng Cấp Chuẩn Công Nghiệp")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(9.5)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(100, 110, 125)

    info_table = doc.add_table(rows=5, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    info_table.columns[0].width = Inches(2.2)
    info_table.columns[1].width = Inches(4.3)
    
    meta_info = [
        ("Tên Hệ Thống:", "TalentLens AI Recruiting Engine (Production-Ready v1.2)"),
        ("Tài Liệu:", "Cẩm Nang Trả Lời Phản Biện Chuyên Sâu Của Hội Đồng Đánh Giá"),
        ("Số Lượng Câu Hỏi:", "25 Câu hỏi chuyên sâu chia thành 8 nhóm chủ đề toàn diện"),
        ("Độ Bao Phủ:", "Thuật toán AI, Chấm điểm Lai, Toán học, PII, Kiến trúc, DB, Testing"),
        ("Năm Thực Hiện:", "Năm Học 2026"),
    ]
    for idx, (label, val) in enumerate(meta_info):
        c1, c2 = info_table.rows[idx].cells
        c1.text = label
        c2.text = val
        c1.paragraphs[0].runs[0].font.bold = True
        c1.paragraphs[0].runs[0].font.color.rgb = RGBColor(27, 54, 93)
        c2.paragraphs[0].runs[0].font.color.rgb = RGBColor(34, 34, 34)
        set_cell_background(c1, "F0F4F8")
        set_cell_background(c2, "FFFFFF")
        set_cell_margins(c1, top=70, bottom=70, left=90, right=90)
        set_cell_margins(c2, top=70, bottom=70, left=90, right=90)

    doc.add_page_break()

    # MỤC LỤC & HƯỚNG DẪN
    add_heading_1(doc, "MỤC LỤC 8 NHÓM CHỦ ĐỀ PHẢN BIỆN CHUYÊN SÂU")
    
    groups = [
        "NHÓM 1: THUẬT TOÁN AI, MÔ HÌNH NGÔN NGỮ & NLP PIPELINE (Câu 1 - 4)",
        "NHÓM 2: CƠ CHẾ CHẤM ĐIỂM LAI (HYBRID SCORING) & TOÁN HỌC (Câu 5 - 8)",
        "NHÓM 3: TÍNH GIẢI TRÌNH (XAI) & TRÍCH XUẤT BẰNG CHỨNG (Câu 9 - 11)",
        "NHÓM 4: BÓC TÁCH TÀI LIỆU, OCR & XỬ LÝ CHUỖI (Câu 12 - 14)",
        "NHÓM 5: KIẾN TRÚC HỆ THỐNG, HÀNG ĐỢI & XỬ LÝ BẤT ĐỒNG BỘ (Câu 15 - 17)",
        "NHÓM 6: CƠ SỞ DỮ LIỆU & LƯU TRỮ TỆP (Câu 18 - 19)",
        "NHÓM 7: AN TOÀN THÔNG TIN, BẢO VỆ DỮ LIỆU CÁ NHÂN (PII) (Câu 20 - 22)",
        "NHÓM 8: ĐẠO ĐỨC AI, NGHIỆP VỤ TUYỂN DỤNG & KIỂM THỬ THỰC NGHIỆM (Câu 23 - 25)",
    ]
    for item in groups:
        p_t = doc.add_paragraph()
        p_t.paragraph_format.space_before = Pt(2)
        p_t.paragraph_format.space_after = Pt(2)
        p_t.paragraph_format.left_indent = Inches(0.2)
        r_t = p_t.add_run(f"✦  {item}")
        r_t.font.name = "Arial"
        r_t.font.size = Pt(9.5)
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(51, 102, 153)

    add_callout_box(
        doc,
        "Nguyên Tắc Vàng Khi Trả Lời Trước Hội Đồng (Chiến Lược Điểm 10)",
        "1. Luôn cảm ơn chân thành: 'Dạ em cảm ơn câu hỏi rất hay và sâu sắc của Thầy/Cô...'\n"
        "2. Không quanh co chối cãi: Khi thầy cô chỉ ra điểm yếu (như regex lọt PII, test fail, rule scorer bắt dính chữ đang học), hãy THỪA NHẬN NGAY LẬP TỨC với tinh thần học thuật cầu thị.\n"
        "3. Đưa ra 3 bước: Thừa nhận -> Chỉ ra cách hệ thống đang giảm thiểu rủi ro -> Nêu giải pháp nâng cấp kỹ thuật cụ thể.\n"
        "4. Dẫn chứng file code thực tế: Thầy cô cực kỳ ấn tượng khi bạn nhớ chính xác tên file và logic hàm trong mã nguồn.",
        "important"
    )

    doc.add_page_break()

    # RENDER 25 QA CARDS
    current_group = ""
    for item in QA_DATA:
        if item["group"] != current_group:
            current_group = item["group"]
            add_heading_1(doc, current_group)
        
        add_qa_card(
            doc,
            num_str=item["num"],
            question=item["question"],
            nature=item["nature"],
            answer=item["answer"],
            code_evidence=item["code"],
            solution=item["solution"]
        )

    output_path = os.path.abspath("BO_CAU_HOI_VA_TRA_LOI_PHAN_BIEN_TALENTLENS.docx")
    doc.save(output_path)
    print(f"QA Document successfully generated at: {output_path}")

if __name__ == "__main__":
    generate_qa_document()
