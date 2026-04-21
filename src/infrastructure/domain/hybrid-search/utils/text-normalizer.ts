/**
 * TextNormalizer - Utility để làm sạch và chuẩn hóa text cho search
 */
export class TextNormalizer {
  /**
   * Làm sạch hoàn toàn text: strip HTML, lowercase, bỏ dấu
   */
  static clean(text: string | null | undefined): string {
    if (!text) return '';
    
    let result = text;
    
    // 1. Strip HTML
    result = result.replace(/<[^>]*>?/gm, ' ');
    
    // 2. Lowercase
    result = result.toLowerCase();
    
    // 3. Normalize Vietnamese (Bỏ dấu)
    result = this.removeVietnameseTones(result);
    
    // 4. Remove special characters (chỉ giữ lại chữ cái, số và khoảng trắng)
    result = result.replace(/[^a-z0-9\s]/g, ' ');
    
    // 5. Clean extra whitespaces
    result = result.replace(/\s+/g, ' ').trim();
    
    return result;
  }

  /**
   * Chỉ strip HTML và làm sạch khoảng trắng (giữ nguyên dấu)
   */
  static stripHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper bỏ dấu tiếng Việt
   */
  static removeVietnameseTones(str: string): string {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    
    // Xử lý các ký tự Unicode tổ hợp
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return str;
  }
}
