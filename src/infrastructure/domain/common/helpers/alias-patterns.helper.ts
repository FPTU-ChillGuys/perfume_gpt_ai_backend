import { Injectable } from '@nestjs/common';
import {
  EntityDictionary,
  EntityType
} from 'src/domain/types/dictionary.types';

/**
 * Seed aliases manually curated for perfume domain.
 * Key = entity type, value = Record<canonical, alias[]>.
 */
const ENRICHMENT_RULES: Partial<Record<EntityType, Record<string, string[]>>> =
  {
    brand: {
      'christian dior': ['dior', 'christiandior', 'cd'],
      'calvin klein': ['ck', 'calvinklein', 'klein'],
      'yves saint laurent': [
        'ysl',
        'saint laurent',
        'laurent',
        'yvessaintlaurent'
      ],
      'giorgio armani': ['armani', 'giorgioarmani', 'ga'],
      'dolce gabbana': ['dg', 'd&g', 'dolcegabbana'],
      'tom ford': ['ford', 'tomford', 'tf'],
      'hugo boss': ['boss', 'hugoboss', 'hb'],
      'ralph lauren': ['rl', 'ralphlauren'],
      chanel: ['xờnen', 'senel'],
      gucci: ['guchy'],
      versace: ['vessace'],
      burberry: ['berbery'],
      lancome: ['lamcome'],
      'este lauder': ['estee', 'lauder'],
      clinique: ['klinik']
    },
    scent_note: {
      'hoa hồng': ['rose', 'hoa hong', 'hong'],
      vanilla: ['vani', 'vanila'],
      'hoa cỏ': ['grass', 'hoa co', 'co'],
      gỗ: ['wood', 'go', 'woody'],
      'hương thảo': ['rosemary', 'huong thao'],
      'cam quýt': ['citrus', 'cam quit', 'bergamot'],
      quế: ['cinnamon', 'que'],
      'đàn hương': ['sandalwood', 'dan huong', 'sandal'],
      'xạ hương': ['musk', 'xa huong'],
      'hổ phách': ['amber', 'ho phach'],
      'hoa nhài': ['jasmine', 'hoa nhai', 'nhai'],
      'hoa sen': ['lotus', 'sen'],
      'hương biển': ['marine', 'huong bien', 'oceanic'],
      'gỗ tuyết tùng': ['cedarwood', 'go tuyet tung', 'tuyet tung'],
      'da thuộc': ['leather', 'da thuoc', 'leathery'],
      'trái cây': ['fruity', 'trai cay', 'fruit'],
      'bạc hà': ['mint', 'bac ha'],
      'lan tây': ['ylang ylang', 'lan tay']
    },
    olfactory_family: {
      'hương hoa cỏ': ['floral', 'huong hoa co', 'floriental'],
      'hương gỗ': ['woody', 'huong go', 'woodsy'],
      'hương tươi': ['fresh', 'huong tuoi', 'aqua'],
      'hương phương đông': ['oriental', 'huong phuong dong', 'spicy', 'orient'],
      'hương cam quýt': ['citrus', 'huong cam quit', 'agrumes'],
      'hương biển': ['aquatic', 'huong bien', 'marine'],
      'hương cỏ cây': ['aromatic', 'huong co cay', 'herbal'],
      'hương thực phẩm': ['gourmand', 'huong thuc pham', 'sweet']
    },
    concentration: {
      'eau de parfum': ['edp', 'eaudeparfum', 'eau de parfum'],
      'eau de toilette': ['edt', 'eaudetoilette', 'eau de toilette'],
      'eau de cologne': ['edc', 'eaudecologne', 'eau de cologne'],
      parfum: ['perfume', 'extrait', 'pure parfum'],
      'eau fraiche': ['ef', 'eaufraiche']
    },
    origin: {
      pháp: ['france', 'phap'],
      ý: ['italy', 'italia', 'y'],
      mỹ: ['usa', 'my', 'america', 'united states'],
      anh: ['uk', 'england', 'britain'],
      đức: ['germany', 'duc'],
      'tây ban nha': ['spain', 'tay ban nha'],
      uae: ['uae', 'arab', 'dubai']
    },
    category: {
      'nước hoa nam': [
        'nam',
        'cho nam',
        'men',
        'male perfume',
        'mens fragrance'
      ],
      'nước hoa nữ': ['nu', 'cho nu', 'women', 'female perfume'],
      'nước hoa unisex': ['unisex', 'cho ca hai', 'both']
    }
  };

@Injectable()
export class AliasPatternsHelper {
  enrichAll(dict: EntityDictionary): void {
    this.enrichSeedAliases(dict);
    this.enrichBrandShortNames(dict);
    this.enrichDiacriticsVariants(dict);
    this.enrichProductBrandLink(dict);
  }

  private enrichSeedAliases(dict: EntityDictionary): void {
    for (const [entityType, rules] of Object.entries(ENRICHMENT_RULES)) {
      const map = dict[entityType as EntityType];
      if (!map) continue;
      for (const [canonical, aliases] of Object.entries(rules ?? {})) {
        if (!map[canonical]) continue;
        map[canonical] = this.mergeAliases(map[canonical], aliases);
      }
    }
  }

  private enrichBrandShortNames(dict: EntityDictionary): void {
    const brandMap = dict.brand;
    if (!brandMap) return;

    for (const canonical of Object.keys(brandMap)) {
      const aliases = this.extractShortNames(canonical);
      brandMap[canonical] = this.mergeAliases(brandMap[canonical], aliases);
    }
  }

  private enrichDiacriticsVariants(dict: EntityDictionary): void {
    for (const map of Object.values(dict)) {
      for (const [canonical, aliases] of Object.entries(map)) {
        const variants = aliases.flatMap((a) => this.asciiVariant(a));
        map[canonical] = this.mergeAliases(aliases, variants);
      }
    }
  }

  private enrichProductBrandLink(dict: EntityDictionary): void {
    const brandMap = dict.brand;
    const productMap = dict.product_name;
    if (!brandMap || !productMap) return;

    const brandCanonicals = Object.keys(brandMap);
    for (const [productCanonical, aliases] of Object.entries(productMap)) {
      const linkedBrands = brandCanonicals.filter(
        (b) =>
          productCanonical.includes(b) || aliases.some((a) => a.includes(b))
      );
      const brandAliases = linkedBrands.flatMap((b) => [
        b,
        ...(brandMap[b] ?? [])
      ]);
      productMap[productCanonical] = this.mergeAliases(aliases, brandAliases);
    }
  }

  private extractShortNames(canonical: string): string[] {
    const words = canonical.split(/\s+/).filter(Boolean);
    if (words.length < 2) return [];

    const last = words[words.length - 1];
    const result: string[] = [];
    if (last.length >= 3) result.push(last);

    if (words.length >= 3) {
      const acronym = words.map((w) => w[0]).join('');
      if (acronym.length >= 2) result.push(acronym);
    }

    return result;
  }

  private asciiVariant(text: string): string[] {
    const ascii = text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đ]/g, 'd')
      .replace(/[Đ]/g, 'D');
    return ascii === text ? [] : [ascii];
  }

  private mergeAliases(existing: string[], additions: string[]): string[] {
    return Array.from(new Set([...existing, ...additions])).filter(Boolean);
  }
}
