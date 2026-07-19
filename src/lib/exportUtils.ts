import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { downloadFile } from './downloadHelper';

/**
 * Exports data to an Excel file
 * @param data Array of objects to export
 * @param fileName Name of the file (without extension)
 * @param sheetName Name of the sheet
 */
export const exportToExcel = async (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Use manual blob generation for better compatibility in some environments
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    await downloadFile(blob, `${fileName}_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw error;
  }
};

/**
 * Exports data to a PDF file using a capture method to support Korean characters
 * @param title Title of the PDF
 * @param headers Table headers
 * @param data Table data rows
 * @param fileName Name of the file (without extension)
 */
export const exportToPDF = async (title: string, headers: string[], data: any[][], fileName: string) => {
  // Create a hidden container for the report
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1000px'; 
  container.style.padding = '0';
  container.style.backgroundColor = '#ffffff';
  
  // Build HTML content with a more sophisticated layout
  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
      * { font-family: 'Noto Sans KR', sans-serif !important; }
    </style>
    <div style="padding: 50px; background: white; min-height: 1200px; position: relative;">
      <!-- Accent Top Bar -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #3b82f6, #6366f1);"></div>
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111827; padding-bottom: 30px; margin-bottom: 40px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <div>
            <h2 style="font-size: 28px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.01em;">건명기업</h2>
            <p style="font-size: 12px; color: #6b7280; font-weight: 500; margin: 0;">스마트 안전 및 인사 관리 솔루션</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h1 style="font-size: 32px; font-weight: 900; color: #111827; margin: 0; letter-spacing: -0.02em;">${title}</h1>
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;">
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">출력 일시</p>
          <p style="font-size: 14px; font-weight: 700; color: #111827;">${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR')}</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">문서 분류</p>
          <p style="font-size: 14px; font-weight: 700; color: #111827;">공식 보고서</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">보안 수준</p>
          <p style="font-size: 14px; font-weight: 700; color: #dc2626;">대외비 (기밀)</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 16px; border: 1px solid #f3f4f6;">
          <p style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">신뢰성 확보</p>
          <p style="font-size: 14px; font-weight: 700; color: #3b82f6;">데이터 무결성 검증됨</p>
        </div>
      </div>

      <!-- Table Section -->
      <div style="background: white; border-radius: 20px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #111827;">
              ${headers.map(h => `<th style="padding: 16px 12px; text-align: left; font-size: 12px; font-weight: 800; color: #f9fafb; border-right: 1px solid rgba(255,255,255,0.1);">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #f3f4f6;">
                ${row.map(cell => {
                  const cellStr = (cell === undefined || cell === null) ? '' : String(cell).trim();
                  const isImage = cellStr.startsWith('data:image/') || cellStr.startsWith('http://') || cellStr.startsWith('https://');
                  const renderedVal = isImage 
                    ? `<img src="${cellStr}" style="height: 28px; max-width: 80px; object-fit: contain;" />` 
                    : cellStr;
                  return `<td style="padding: 14px 12px; font-size: 13px; font-weight: 500; color: #374151; vertical-align: middle;">${renderedVal}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 60px; padding: 40px; background: #111827; border-radius: 24px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 18px; font-weight: 900; margin: 0 0 8px 0;">건명기업(주)</h3>
            <p style="font-size: 11px; opacity: 0.6; margin: 0;">본 리포트의 무단 복제 및 유출은 법적 처벌을 받을 수 있습니다.</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; opacity: 0.8; font-weight: 700; margin: 0;">&copy; ${new Date().getFullYear()} 건명기업. 모든 권리 보유.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);

  // Wait a bit for images to load
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const canvas = await html2canvas(container, {
      scale: 1.2, // Reduced scale for better memory management on mobile
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Using medium quality JPEG significantly reduces memory usage and file size
    const imgData = canvas.toDataURL('image/jpeg', 0.75); 
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;
    
    let heightLeft = imgHeightInPdf;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
    heightLeft -= pdfPageHeight;

    // Add subsequent pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeightInPdf;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
      heightLeft -= pdfPageHeight;
    }
    
    // Use manual blob generation for better compatibility
    const pdfBlob = pdf.output('blob');
    await downloadFile(pdfBlob, `${fileName}_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
};
