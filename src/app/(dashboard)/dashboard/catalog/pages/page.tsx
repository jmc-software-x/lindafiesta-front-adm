'use client';

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { extractErrorMessage } from '@/lib/common/api-response';
import { setJsonValueByPath } from '@/lib/common/json-path';
import {
  resolveImageViewUrl,
  SourceMode,
  uploadImageWithPresign,
} from '@/lib/files/image-upload-controller';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

type PageStatus = 'DRAFT' | 'PUBLISHED';
type PageBlockType =
  | 'hero-collage'
  | 'about'
  | 'triptych-images'
  | 'categories'
  | 'gallery-grid'
  | 'cta'
  | 'promotions'
  | 'carousel';

type TemplateKey = 'home-basic' | 'about-basic' | 'carousel-basic';

interface PageBlock {
  id: string;
  type: PageBlockType;
  order: number;
  isEnabled: boolean;
  data: Record<string, unknown>;
}

interface TenantScope {
  countryCode: string;
  cityCode: string;
}

interface PageDraftPayload {
  schemaVersion: number;
  slug: string;
  locale: string;
  tenant: TenantScope;
  theme: Record<string, unknown>;
  blocks: PageBlock[];
}

interface AdminPageResponse {
  schemaVersion?: number;
  slug: string;
  locale: string;
  tenant?: {
    countryCode?: string;
    cityCode?: string;
  } | null;
  status: PageStatus;
  version: number | null;
  blocks: unknown;
  theme: unknown;
  publishedVersionId: string | null;
}

interface BlockDraft {
  id: string;
  type: PageBlockType;
  order: string;
  isEnabled: boolean;
  dataJson: string;
  uploadPath: string;
  uploadMode: SourceMode;
  uploadFile: File | null;
  previewUrl: string | null;
}

const BLOCK_TYPES: PageBlockType[] = [
  'hero-collage',
  'about',
  'triptych-images',
  'categories',
  'gallery-grid',
  'cta',
  'promotions',
  'carousel',
];

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  'home-basic': 'Home basico',
  'about-basic': 'About basico',
  'carousel-basic': 'Carousel basico',
};

function isPageBlockType(value: string): value is PageBlockType {
  return BLOCK_TYPES.includes(value as PageBlockType);
}

function normalizeBlockType(value: string): PageBlockType {
  if (value === 'triptych') {
    return 'triptych-images';
  }

  if (isPageBlockType(value)) {
    return value;
  }

  return 'about';
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function normalizeSlug(input: string): string {
  const trimmed = input.trim().toLowerCase();
  return trimmed || 'home';
}

function normalizeLocale(input: string): string {
  const trimmed = input.trim();
  return trimmed || 'es-PE';
}

function normalizeCountryCode(input: string): string {
  const normalized = input.trim().toUpperCase();
  return normalized || 'PE';
}

function normalizeCityCode(input: string): string {
  const normalized = input.trim().toUpperCase();
  return normalized || 'LIM';
}

function defaultUploadPathByType(type: PageBlockType): string {
  switch (type) {
    case 'hero-collage':
      return 'images.main.src';
    case 'categories':
      return 'cards.0.image.src';
    case 'gallery-grid':
      return 'items.0.src';
    case 'triptych-images':
      return 'images.0.src';
    case 'carousel':
      return 'slides.0.src';
    default:
      return 'image.src';
  }
}

function blockTemplateData(type: PageBlockType): Record<string, unknown> {
  switch (type) {
    case 'hero-collage':
      return {
        headline: 'Creando momentos\\nque capturan\\ntu corazon',
        cta: {
          label: 'Cotizar',
          href: '/cotizar',
          variant: 'outline',
        },
        images: {
          main: { src: '', alt: 'Imagen principal hero', crop: '3:4' },
          top: { src: '', alt: 'Imagen superior hero', crop: '1:1' },
          bottom: { src: '', alt: 'Imagen inferior hero', crop: '4:3' },
        },
        options: {
          showRightPanelOnDesktop: true,
          frameBorderPx: 10,
          enableHeroArrows: false,
        },
      };
    case 'about':
      return {
        title: 'LindaFiestas',
        tagline: 'Porque los momentos hermosos merecen ser perfectos',
        paragraphs: [
          'Somos expertos en crear experiencias inolvidables.',
          'Cuidamos cada detalle para que solo disfrutes.',
        ],
      };
    case 'triptych-images':
      return {
        images: [
          { src: '', alt: 'Triptych 1', crop: '4:5', offset: 'none' },
          { src: '', alt: 'Triptych 2', crop: '4:5', offset: 'down' },
          { src: '', alt: 'Triptych 3', crop: '4:5', offset: 'none' },
        ],
        options: {
          middleImageOffsetPxDesktop: 48,
        },
      };
    case 'categories':
      return {
        title: 'Lista para tu aventura?',
        cards: [
          {
            label: 'Matrimonios',
            href: '/servicios/matrimonios',
            image: { src: '', alt: 'Categoria matrimonios' },
          },
          {
            label: 'XV Años',
            href: '/servicios/xv-anos',
            image: { src: '', alt: 'Categoria XV años' },
          },
          {
            label: 'Corporativos',
            href: '/servicios/corporativos',
            image: { src: '', alt: 'Categoria corporativos' },
          },
        ],
        footerLink: {
          label: 'Ver todos los paquetes',
          href: '/paquetes',
        },
      };
    case 'gallery-grid':
      return {
        title: 'Nuestra galeria',
        subtitle: 'Momentos que hemos creado juntos',
        items: [
          { src: '', alt: 'Galeria 1', span: '1x1' },
          { src: '', alt: 'Galeria 2', span: '1x1' },
          { src: '', alt: 'Galeria 3', span: '1x1' },
          { src: '', alt: 'Galeria 4', span: '1x1' },
          { src: '', alt: 'Galeria 5', span: '2x1' },
          { src: '', alt: 'Galeria 6', span: '2x1' },
        ],
      };
    case 'cta':
      return {
        title: 'Lista para crear el evento de tus sueños?',
        subtitle: 'Cuentanos tu vision y hagamos magia juntos',
        cta: {
          label: 'Solicitar cotizacion',
          href: '/cotizar',
          variant: 'outline',
        },
        tone: 'dark',
      };
    case 'promotions':
      return {
        items: [{ title: 'Promo', description: 'Descripcion promo' }],
      };
    case 'carousel':
      return {
        slides: [{ src: '', alt: 'Slide 1' }],
      };
    default:
      return {};
  }
}

function normalizeBlockData(type: PageBlockType, data: Record<string, unknown>): Record<string, unknown> {
  if (type === 'hero-collage') {
    if (typeof data.headline === 'string' && data.cta && data.images) {
      return data;
    }

    return {
      headline: ensureString(data.title) || ensureString(data.headline),
      cta: {
        label:
          ensureString(getValueByPath(data, 'cta.label')) ||
          ensureString(data.actionLabel) ||
          'Cotizar',
        href:
          ensureString(getValueByPath(data, 'cta.href')) ||
          ensureString(data.actionHref) ||
          '/cotizar',
        variant: ensureString(getValueByPath(data, 'cta.variant')) || 'outline',
      },
      images: {
        main: {
          src: ensureString(getValueByPath(data, 'images.main.src')),
          alt: ensureString(getValueByPath(data, 'images.main.alt')) || 'Imagen principal hero',
          crop: ensureString(getValueByPath(data, 'images.main.crop')) || '3:4',
        },
        top: {
          src:
            ensureString(getValueByPath(data, 'images.top.src')) ||
            ensureString(getValueByPath(data, 'images.secondary.0.src')),
          alt: ensureString(getValueByPath(data, 'images.top.alt')) || 'Imagen superior hero',
          crop: ensureString(getValueByPath(data, 'images.top.crop')) || '1:1',
        },
        bottom: {
          src:
            ensureString(getValueByPath(data, 'images.bottom.src')) ||
            ensureString(getValueByPath(data, 'images.secondary.1.src')),
          alt: ensureString(getValueByPath(data, 'images.bottom.alt')) || 'Imagen inferior hero',
          crop: ensureString(getValueByPath(data, 'images.bottom.crop')) || '4:3',
        },
      },
      options: {
        showRightPanelOnDesktop:
          getValueByPath(data, 'options.showRightPanelOnDesktop') === false ? false : true,
        frameBorderPx: Number(getValueByPath(data, 'options.frameBorderPx')) || 10,
        enableHeroArrows:
          getValueByPath(data, 'options.enableHeroArrows') === true ? true : false,
      },
    };
  }

  if (type === 'about') {
    const paragraphsFromArray = Array.isArray(data.paragraphs)
      ? data.paragraphs.filter((item): item is string => typeof item === 'string')
      : [];

    const fallbackDescription = ensureString(data.description);

    return {
      title: ensureString(data.title) || 'LindaFiestas',
      tagline: ensureString(data.tagline) || 'Porque los momentos hermosos merecen ser perfectos',
      paragraphs:
        paragraphsFromArray.length > 0
          ? paragraphsFromArray
          : fallbackDescription
            ? [fallbackDescription]
            : [''],
    };
  }

  if (type === 'triptych-images') {
    const images = Array.isArray(data.images) ? data.images : [];
    return {
      images: [0, 1, 2].map((index) => ({
        src: ensureString(getValueByPath({ images }, `images.${index}.src`)),
        alt:
          ensureString(getValueByPath({ images }, `images.${index}.alt`)) ||
          `Triptych ${index + 1}`,
        crop: ensureString(getValueByPath({ images }, `images.${index}.crop`)) || '4:5',
        offset: ensureString(getValueByPath({ images }, `images.${index}.offset`)) || (index === 1 ? 'down' : 'none'),
      })),
      options: {
        middleImageOffsetPxDesktop:
          Number(getValueByPath(data, 'options.middleImageOffsetPxDesktop')) || 48,
      },
    };
  }

  if (type === 'categories') {
    const cards = Array.isArray(data.cards) ? data.cards : [];
    return {
      title: ensureString(data.title) || 'Lista para tu aventura?',
      cards: [0, 1, 2].map((index) => ({
        label: ensureString(getValueByPath({ cards }, `cards.${index}.label`)),
        href: ensureString(getValueByPath({ cards }, `cards.${index}.href`)),
        image: {
          src:
            ensureString(getValueByPath({ cards }, `cards.${index}.image.src`)) ||
            ensureString(getValueByPath({ cards }, `cards.${index}.image`)),
          alt:
            ensureString(getValueByPath({ cards }, `cards.${index}.image.alt`)) ||
            `Categoria ${index + 1}`,
        },
      })),
      footerLink: {
        label:
          ensureString(getValueByPath(data, 'footerLink.label')) ||
          'Ver todos los paquetes',
        href: ensureString(getValueByPath(data, 'footerLink.href')) || '/paquetes',
      },
    };
  }

  if (type === 'gallery-grid') {
    const legacyImages = Array.isArray(data.images) ? data.images : [];
    const items = Array.isArray(data.items) ? data.items : legacyImages;

    return {
      title: ensureString(data.title) || 'Nuestra galeria',
      subtitle: ensureString(data.subtitle) || 'Momentos que hemos creado juntos',
      items: [0, 1, 2, 3, 4, 5].map((index) => ({
        src: ensureString(getValueByPath({ items }, `items.${index}.src`)),
        alt: ensureString(getValueByPath({ items }, `items.${index}.alt`)) || `Foto galeria ${index + 1}`,
        span:
          ensureString(getValueByPath({ items }, `items.${index}.span`)) ||
          (index > 3 ? '2x1' : '1x1'),
      })),
    };
  }

  if (type === 'cta') {
    return {
      title: ensureString(data.title) || 'Solicitar cotizacion',
      subtitle: ensureString(data.subtitle),
      cta: {
        label:
          ensureString(getValueByPath(data, 'cta.label')) ||
          ensureString(data.actionLabel) ||
          'Cotizar',
        href:
          ensureString(getValueByPath(data, 'cta.href')) ||
          ensureString(data.actionHref) ||
          '/cotizar',
        variant: ensureString(getValueByPath(data, 'cta.variant')) || 'outline',
      },
      tone: ensureString(data.tone) || 'dark',
    };
  }

  if (type === 'carousel') {
    const rawSlides = Array.isArray(data.slides) ? data.slides : [];
    const normalizedSlides = rawSlides
      .map((item, index) => {
        const record =
          item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : {};

        return {
          src: ensureString(record.src),
          alt: ensureString(record.alt) || `Slide ${index + 1}`,
        };
      })
      .filter((slide) => slide.src || slide.alt);

    return {
      slides: normalizedSlides.length > 0 ? normalizedSlides : [{ src: '', alt: 'Slide 1' }],
    };
  }

  return data;
}

function parseBlocks(input: unknown): PageBlock[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is PageBlock => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as Record<string, unknown>;
      return (
        typeof record.id === 'string' &&
        typeof record.type === 'string' &&
        typeof record.order === 'number' &&
        typeof record.isEnabled === 'boolean' &&
        record.data !== null &&
        typeof record.data === 'object' &&
        !Array.isArray(record.data)
      );
    })
    .map((block) => ({
      ...block,
      type: normalizeBlockType(block.type),
      data: normalizeBlockData(
        normalizeBlockType(block.type),
        block.data as Record<string, unknown>
      ),
    }));
}

function buildBlockDraft(block: PageBlock): BlockDraft {
  return {
    id: block.id,
    type: block.type,
    order: String(block.order),
    isEnabled: block.isEnabled,
    dataJson: prettyJson(block.data),
    uploadPath: defaultUploadPathByType(block.type),
    uploadMode: 'key',
    uploadFile: null,
    previewUrl: null,
  };
}

function parseRecordJson(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} debe ser un objeto JSON.`);
  }

  return parsed as Record<string, unknown>;
}

function uniqueBlockId(type: PageBlockType): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString().slice(-6);

  return `${type}-${suffix}`;
}

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getValueByPath(input: Record<string, unknown>, path: string): unknown {
  const segments = path
    .split('.')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (/^\d+$/.test(item) ? Number(item) : item));

  let current: unknown = input;
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function reorderBlocks(current: BlockDraft[], sourceId: string, targetId: string): BlockDraft[] {
  const sourceIndex = current.findIndex((block) => block.id === sourceId);
  const targetIndex = current.findIndex((block) => block.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return current;
  }

  const next = [...current];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);

  return next.map((block, index) => ({
    ...block,
    order: String((index + 1) * 10),
  }));
}

function buildTemplateBlocks(template: TemplateKey): PageBlock[] {
  if (template === 'about-basic') {
    return [
      {
        id: 'about-1',
        type: 'about',
        order: 10,
        isEnabled: true,
        data: {
          title: 'LindaFiestas',
          tagline: 'Porque los momentos hermosos merecen ser perfectos',
          paragraphs: [
            'Somos expertos en crear experiencias inolvidables.',
            'Transformamos tus ideas en eventos extraordinarios.',
          ],
        },
      },
    ];
  }

  if (template === 'carousel-basic') {
    return [
      {
        id: 'carousel-1',
        type: 'carousel',
        order: 10,
        isEnabled: true,
        data: {
          slides: [
            { src: '', alt: 'Slide principal' },
            { src: '', alt: 'Slide secundario' },
          ],
        },
      },
      {
        id: 'cta-1',
        type: 'cta',
        order: 20,
        isEnabled: true,
        data: {
          title: 'Reserva tu fecha',
          subtitle: 'Nuestro equipo te ayuda a definir el concepto ideal.',
          cta: {
            label: 'Hablar con asesor',
            href: '/cotizar',
            variant: 'outline',
          },
          tone: 'dark',
        },
      },
    ];
  }

  return [
    {
      id: 'hero-1',
      type: 'hero-collage',
      order: 10,
      isEnabled: true,
      data: {
        headline: 'Creando momentos\\nque capturan\\ntu corazon',
        cta: {
          label: 'Cotizar',
          href: '/cotizar',
          variant: 'outline',
        },
        images: {
          main: { src: '', alt: 'Pareja celebrando un momento especial', crop: '3:4' },
          top: { src: '', alt: 'Vista editorial en luz calida', crop: '1:1' },
          bottom: { src: '', alt: 'Escena urbana con estilo editorial', crop: '4:3' },
        },
        options: {
          showRightPanelOnDesktop: true,
          frameBorderPx: 10,
          enableHeroArrows: false,
        },
      },
    },
    {
      id: 'about-1',
      type: 'about',
      order: 20,
      isEnabled: true,
      data: {
        title: 'LindaFiestas',
        tagline: 'Porque los momentos hermosos merecen ser perfectos',
        paragraphs: [
          'Somos expertos en crear experiencias inolvidables.',
          'Con mas de 10 anos de experiencia, cuidamos cada detalle.',
        ],
      },
    },
    {
      id: 'triptych-1',
      type: 'triptych-images',
      order: 30,
      isEnabled: true,
      data: {
        images: [
          { src: '', alt: 'Triptych 1', crop: '4:5', offset: 'none' },
          { src: '', alt: 'Triptych 2', crop: '4:5', offset: 'down' },
          { src: '', alt: 'Triptych 3', crop: '4:5', offset: 'none' },
        ],
        options: {
          middleImageOffsetPxDesktop: 48,
        },
      },
    },
    {
      id: 'categories-1',
      type: 'categories',
      order: 40,
      isEnabled: true,
      data: {
        title: 'Lista para tu aventura?',
        cards: [
          {
            label: 'Matrimonios',
            href: '/servicios/matrimonios',
            image: { src: '', alt: 'Matrimonio en ambiente calido' },
          },
          {
            label: 'XV Años',
            href: '/servicios/xv-anos',
            image: { src: '', alt: 'Celebracion de quince anos' },
          },
          {
            label: 'Corporativos',
            href: '/servicios/corporativos',
            image: { src: '', alt: 'Evento corporativo' },
          },
        ],
        footerLink: {
          label: 'Ver todos los paquetes',
          href: '/paquetes',
        },
      },
    },
    {
      id: 'gallery-1',
      type: 'gallery-grid',
      order: 50,
      isEnabled: true,
      data: {
        title: 'Nuestra galeria',
        subtitle: 'Momentos que hemos creado juntos',
        items: [
          { src: '', alt: 'Foto galeria 1', span: '1x1' },
          { src: '', alt: 'Foto galeria 2', span: '1x1' },
          { src: '', alt: 'Foto galeria 3', span: '1x1' },
          { src: '', alt: 'Foto galeria 4', span: '1x1' },
          { src: '', alt: 'Foto galeria 5', span: '2x1' },
          { src: '', alt: 'Foto galeria 6', span: '2x1' },
        ],
      },
    },
    {
      id: 'cta-1',
      type: 'cta',
      order: 60,
      isEnabled: true,
      data: {
        title: 'Lista para crear el evento de tus sueños?',
        subtitle: 'Cuentanos tu vision y hagamos magia juntos',
        cta: {
          label: 'Solicitar cotizacion',
          href: '/cotizar',
          variant: 'outline',
        },
        tone: 'dark',
      },
    },
  ];
}

export default function CmsPagesCatalogPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [slug, setSlug] = useState('home');
  const [locale, setLocale] = useState('es-PE');
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [tenantCountryCode, setTenantCountryCode] = useState('PE');
  const [tenantCityCode, setTenantCityCode] = useState('LIM');
  const [pageStatus, setPageStatus] = useState<PageStatus>('DRAFT');
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [lastPersistedSnapshot, setLastPersistedSnapshot] = useState<string | null>(null);

  const [themeJson, setThemeJson] = useState('{}');
  const [blocks, setBlocks] = useState<BlockDraft[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  const [pageJsonDraft, setPageJsonDraft] = useState('{}');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('home-basic');

  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [selectedNewType, setSelectedNewType] = useState<PageBlockType>('cta');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleBlocks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return blocks;
    }

    return blocks.filter((block) => {
      const haystack = [block.id, block.type, block.order, block.isEnabled ? 'enabled' : 'disabled']
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [blocks, searchTerm]);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  const buildPagePayload = useCallback(() => {
    const parsedTheme = parseRecordJson(themeJson, 'theme');
    const normalizedSlug = normalizeSlug(slug);
    const normalizedLocale = normalizeLocale(locale);
    const normalizedSchemaVersion = Math.max(1, Math.floor(Number(schemaVersion) || 1));
    const tenant: TenantScope = {
      countryCode: normalizeCountryCode(tenantCountryCode),
      cityCode: normalizeCityCode(tenantCityCode),
    };

    if (!/^[A-Z]{2}$/.test(tenant.countryCode)) {
      throw new Error('tenant.countryCode debe ser ISO-2 (ej: MX).');
    }

    if (!/^[A-Z0-9_-]{2,12}$/.test(tenant.cityCode)) {
      throw new Error('tenant.cityCode invalido. Usa uppercase, 2-12 chars (ej: GDL).');
    }

    const seenIds = new Set<string>();
    const seenOrders = new Set<number>();

    const parsedBlocks: PageBlock[] = blocks.map((block, index) => {
      const id = block.id.trim();
      if (!id) {
        throw new Error(`El block #${index + 1} requiere id.`);
      }
      if (seenIds.has(id)) {
        throw new Error(`El id de block "${id}" esta duplicado.`);
      }
      seenIds.add(id);

      const order = Number(block.order);
      if (!Number.isInteger(order) || order < 0) {
        throw new Error(`El block "${id}" requiere order entero >= 0.`);
      }
      if (seenOrders.has(order)) {
        throw new Error(`El order ${order} esta duplicado. Cada block debe tener order unico.`);
      }
      seenOrders.add(order);

      const parsedData = parseRecordJson(block.dataJson, `data del block "${id}"`);

      return {
        id,
        type: block.type,
        order,
        isEnabled: block.isEnabled,
        data: parsedData,
      };
    });

    if (parsedBlocks.length === 0) {
      throw new Error('Debe existir al menos un block para guardar draft.');
    }

    return {
      schemaVersion: normalizedSchemaVersion,
      slug: normalizedSlug,
      locale: normalizedLocale,
      tenant,
      theme: parsedTheme,
      blocks: parsedBlocks.sort((a, b) => a.order - b.order),
    };
  }, [blocks, locale, schemaVersion, slug, tenantCityCode, tenantCountryCode, themeJson]);

  const syncPageJsonFromVisual = useCallback(() => {
    try {
      const payload = buildPagePayload();
      setPageJsonDraft(prettyJson(payload));
      setFormError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo construir JSON de pagina.';
      setFormError(message);
    }
  }, [buildPagePayload]);

  const currentVisualSnapshot = useMemo(() => {
    try {
      return JSON.stringify(buildPagePayload());
    } catch {
      return null;
    }
  }, [buildPagePayload]);

  const hasLocalChanges = useMemo(() => {
    if (!lastPersistedSnapshot) {
      return false;
    }

    if (!currentVisualSnapshot) {
      return true;
    }

    return currentVisualSnapshot !== lastPersistedSnapshot;
  }, [currentVisualSnapshot, lastPersistedSnapshot]);

  const loadPage = useCallback(
    async (nextSlug = slug, nextLocale = locale) => {
      const normalizedSlug = normalizeSlug(nextSlug);
      const normalizedLocale = normalizeLocale(nextLocale);

      setIsFetching(true);
      setLoadError(null);
      setFormError(null);
      startLoading('cms-pages.fetch');

      try {
        const query = new URLSearchParams({ locale: normalizedLocale });
        const response = await fetch(`/api/admin/pages/${encodeURIComponent(normalizedSlug)}?${query.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, 'No se pudo obtener la pagina CMS.'));
        }

        const page = payload as AdminPageResponse;
        const parsedBlocks = parseBlocks(page.blocks).sort((a, b) => a.order - b.order);
        const nextBlocks = parsedBlocks.map(buildBlockDraft);
        const nextTheme =
          page.theme && typeof page.theme === 'object' && !Array.isArray(page.theme) ? page.theme : {};
        const nextThemeJson = prettyJson(nextTheme);
        const nextSchemaVersion =
          typeof page.schemaVersion === 'number' && Number.isFinite(page.schemaVersion)
            ? Math.max(1, Math.floor(page.schemaVersion))
            : 1;
        const nextTenantCountry = normalizeCountryCode(page.tenant?.countryCode ?? tenantCountryCode);
        const nextTenantCity = normalizeCityCode(page.tenant?.cityCode ?? tenantCityCode);

        setSlug(page.slug || normalizedSlug);
        setLocale(page.locale || normalizedLocale);
        setSchemaVersion(nextSchemaVersion);
        setTenantCountryCode(nextTenantCountry);
        setTenantCityCode(nextTenantCity);
        setPageStatus(page.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT');
        setCurrentVersion(typeof page.version === 'number' ? page.version : null);
        setPublishedVersionId(typeof page.publishedVersionId === 'string' ? page.publishedVersionId : null);
        const persistedPayload: PageDraftPayload = {
          schemaVersion: nextSchemaVersion,
          slug: page.slug || normalizedSlug,
          locale: page.locale || normalizedLocale,
          tenant: {
            countryCode: nextTenantCountry,
            cityCode: nextTenantCity,
          },
          theme: nextTheme as Record<string, unknown>,
          blocks: parsedBlocks,
        };
        setLastPersistedSnapshot(JSON.stringify(persistedPayload));
        setThemeJson(nextThemeJson);
        setBlocks(nextBlocks);
        setSelectedBlockId(nextBlocks[0]?.id ?? null);

        setPageJsonDraft(
          prettyJson(persistedPayload)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado al cargar la pagina CMS.';
        setLoadError(message);
        reportError({
          source: 'api',
          message,
          details: 'GET /admin/pages/:slug',
        });
      } finally {
        stopLoading('cms-pages.fetch');
        setIsFetching(false);
      }
    },
    [locale, reportError, slug, startLoading, stopLoading, tenantCityCode, tenantCountryCode]
  );

  useEffect(() => {
    void loadPage('home', 'es-PE');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBlock = (blockId: string, updater: (draft: BlockDraft) => BlockDraft) => {
    setBlocks((current) => current.map((item) => (item.id === blockId ? updater(item) : item)));
  };

  const mutateBlockData = (blockId: string, mutator: (data: Record<string, unknown>) => void) => {
    const target = blocks.find((block) => block.id === blockId);
    if (!target) {
      return;
    }

    try {
      const parsedData = parseRecordJson(target.dataJson, `data del block "${target.id}"`);
      mutator(parsedData);

      updateBlock(blockId, (current) => ({
        ...current,
        dataJson: prettyJson(parsedData),
      }));
      setFormError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo editar el JSON del block.';
      setFormError(message);
    }
  };

  const setBlockDataPath = (blockId: string, path: string, value: unknown) => {
    mutateBlockData(blockId, (data) => {
      setJsonValueByPath(data, path, value);
    });
  };

  const saveDraft = async (options?: { silentNotification?: boolean }): Promise<string | null> => {
    const normalizedSlug = normalizeSlug(slug);
    const loadingKey = 'cms-pages.save-draft';

    setFormError(null);
    clearErrors();
    setIsSaving(true);
    startLoading(loadingKey);

    try {
      const payload = buildPagePayload();
      const persistedSnapshot = JSON.stringify(payload);
      const response = await fetch(`/api/admin/pages/${encodeURIComponent(normalizedSlug)}/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo guardar draft de pagina.'));
      }

      const parsed = body as Record<string, unknown>;
      const nextVersionId = typeof parsed.versionId === 'string' ? parsed.versionId : null;
      const nextVersion = typeof parsed.version === 'number' ? parsed.version : currentVersion;

      setPageStatus('DRAFT');
      setLastPersistedSnapshot(persistedSnapshot);
      setCurrentVersion(nextVersion ?? null);
      setPageJsonDraft(prettyJson(payload));

      if (!options?.silentNotification) {
        pushNotification({
          type: 'success',
          title: 'Draft guardado',
          message: `${normalizedSlug} (${normalizeLocale(locale)})`,
        });
      }

      return nextVersionId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al guardar draft.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'PUT /admin/pages/:slug/draft',
      });
      return null;
    } finally {
      stopLoading(loadingKey);
      setIsSaving(false);
    }
  };

  const publishVersion = async (versionId: string): Promise<boolean> => {
    const normalizedSlug = normalizeSlug(slug);
    const loadingKey = 'cms-pages.publish';

    setIsPublishing(true);
    startLoading(loadingKey);

    try {
      const response = await fetch(`/api/admin/pages/${encodeURIComponent(normalizedSlug)}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: normalizeLocale(locale),
          versionId,
        }),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo publicar la pagina.'));
      }

      const parsed = body as Record<string, unknown>;

      setPageStatus('PUBLISHED');
      setPublishedVersionId(
        typeof parsed.publishedVersionId === 'string' ? parsed.publishedVersionId : publishedVersionId
      );
      setCurrentVersion(typeof parsed.version === 'number' ? parsed.version : currentVersion);

      pushNotification({
        type: 'success',
        title: 'Pagina publicada',
        message: `${normalizedSlug} v${typeof parsed.version === 'number' ? parsed.version : 'n/a'}`,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al publicar pagina.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'POST /admin/pages/:slug/publish',
      });
      return false;
    } finally {
      stopLoading(loadingKey);
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isPublishing) {
      return;
    }

    await saveDraft();
  };

  const handlePublish = async () => {
    if (isSaving || isPublishing) {
      return;
    }

    const versionId = await saveDraft({ silentNotification: true });

    if (!versionId) {
      return;
    }

    const published = await publishVersion(versionId);
    if (published) {
      await loadPage(slug, locale);
    }
  };

  const handleRevertLocalChanges = async () => {
    if (isFetching || isSaving || isPublishing) {
      return;
    }

    if (!hasLocalChanges) {
      pushNotification({
        type: 'info',
        title: 'Sin cambios locales',
        message: 'No hay cambios pendientes por revertir.',
      });
      return;
    }

    const shouldRevert = window.confirm(
      'Se descartaran los cambios locales no guardados y se recargara la pagina desde backend. ¿Continuar?'
    );

    if (!shouldRevert) {
      return;
    }

    await loadPage(slug, locale);
  };

  const handleAddBlock = () => {
    const newBlock: BlockDraft = {
      id: uniqueBlockId(selectedNewType),
      type: selectedNewType,
      order: String(blocks.length ? (blocks.length + 1) * 10 : 10),
      isEnabled: true,
      dataJson: prettyJson(blockTemplateData(selectedNewType)),
      uploadPath: defaultUploadPathByType(selectedNewType),
      uploadMode: 'key',
      uploadFile: null,
      previewUrl: null,
    };

    setBlocks((current) => [...current, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlocks((current) => {
      const next = current.filter((block) => block.id !== blockId);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleUploadImage = async (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block?.uploadFile) {
      pushNotification({
        type: 'warning',
        title: 'Selecciona un archivo',
        message: 'Debes seleccionar una imagen antes de subir.',
      });
      return;
    }

    if (uploadingBlockId) {
      return;
    }

    setUploadingBlockId(blockId);
    startLoading(`cms-pages.upload.${blockId}`);

    try {
      const parsedData = parseRecordJson(block.dataJson, `data del block "${block.id}"`);
      const upload = await uploadImageWithPresign({
        file: block.uploadFile,
        folder: 'pages',
        sourceMode: block.uploadMode,
        signedGetTtlSeconds: 900,
        resolvePreviewUrl: true,
      });

      setJsonValueByPath(parsedData, block.uploadPath, upload.sourceValue);

      updateBlock(blockId, (current) => ({
        ...current,
        dataJson: prettyJson(parsedData),
        uploadFile: null,
        previewUrl: upload.previewUrl,
      }));

      pushNotification({
        type: 'success',
        title: 'Imagen cargada en bloque',
        message: `${block.id} -> ${block.uploadPath}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al subir imagen.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'Flow pages image: presign -> PUT S3 -> set data path',
      });
      pushNotification({
        type: 'error',
        title: 'No se pudo subir imagen',
        message,
      });
    } finally {
      stopLoading(`cms-pages.upload.${blockId}`);
      setUploadingBlockId(null);
    }
  };

  const handleViewImageFromBlockPath = async (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }

    try {
      const parsedData = parseRecordJson(block.dataJson, `data del block "${block.id}"`);
      const sourceValue = getValueByPath(parsedData, block.uploadPath);

      if (typeof sourceValue !== 'string' || !sourceValue.trim()) {
        throw new Error('No se encontro imagen en el path actual del block.');
      }

      const previewUrl = await resolveImageViewUrl({
        source: sourceValue,
        signedGetTtlSeconds: 900,
      });

      updateBlock(blockId, (current) => ({
        ...current,
        previewUrl,
      }));

      pushNotification({
        type: 'info',
        title: 'Preview actualizado',
        message: `${block.id} -> ${block.uploadPath}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo resolver la imagen.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'Resolve image from block path',
      });
    }
  };

  const handleDropOnBlock = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingBlockId || draggingBlockId === targetId) {
      return;
    }

    setBlocks((current) => reorderBlocks(current, draggingBlockId, targetId));
    setDraggingBlockId(null);
  };

  const applyTemplate = () => {
    const templateBlocks = buildTemplateBlocks(selectedTemplate).map(buildBlockDraft);
    const nextTheme = {
      palette: {
        base: '#FDF8F5',
        accent: '#F5E6D8',
        primary: '#6B5B4F',
        muted: '#8B7355',
        highlight: '#D4A574',
      },
    };

    setBlocks(templateBlocks);
    setThemeJson(prettyJson(nextTheme));
    setSchemaVersion(1);
    setSelectedBlockId(templateBlocks[0]?.id ?? null);
    setPageStatus('DRAFT');

    setPageJsonDraft(
      prettyJson({
        schemaVersion: 1,
        slug: normalizeSlug(slug),
        locale: normalizeLocale(locale),
        tenant: {
          countryCode: normalizeCountryCode(tenantCountryCode),
          cityCode: normalizeCityCode(tenantCityCode),
        },
        theme: nextTheme,
        blocks: templateBlocks.map((block) => ({
          id: block.id,
          type: block.type,
          order: Number(block.order),
          isEnabled: block.isEnabled,
          data: parseRecordJson(block.dataJson, `data del block "${block.id}"`),
        })),
      })
    );

    pushNotification({
      type: 'success',
      title: 'Template aplicado',
      message: TEMPLATE_LABELS[selectedTemplate],
    });
  };

  const applyPageJsonToVisual = () => {
    try {
      const parsed = JSON.parse(pageJsonDraft) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('El JSON de pagina debe ser un objeto.');
      }

      const record = parsed as Record<string, unknown>;
      const nextSlug = typeof record.slug === 'string' ? normalizeSlug(record.slug) : normalizeSlug(slug);
      const nextLocale = typeof record.locale === 'string' ? normalizeLocale(record.locale) : normalizeLocale(locale);
      const nextSchemaVersion =
        typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)
          ? Math.max(1, Math.floor(record.schemaVersion))
          : 1;
      const tenant = record.tenant && typeof record.tenant === 'object' ? (record.tenant as Record<string, unknown>) : {};
      const nextTheme =
        record.theme && typeof record.theme === 'object' && !Array.isArray(record.theme) ? record.theme : {};
      const nextBlocks = parseBlocks(record.blocks).sort((a, b) => a.order - b.order).map(buildBlockDraft);

      setSlug(nextSlug);
      setLocale(nextLocale);
      setSchemaVersion(nextSchemaVersion);
      setTenantCountryCode(normalizeCountryCode(ensureString(tenant.countryCode)));
      setTenantCityCode(normalizeCityCode(ensureString(tenant.cityCode)));
      setThemeJson(prettyJson(nextTheme));
      setBlocks(nextBlocks);
      setSelectedBlockId(nextBlocks[0]?.id ?? null);
      setFormError(null);

      pushNotification({
        type: 'success',
        title: 'JSON aplicado',
        message: 'Se actualizo el editor visual desde el JSON.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo aplicar JSON de pagina.';
      setFormError(message);
    }
  };

  const renderVisualFields = (block: BlockDraft) => {
    let parsedData: Record<string, unknown>;

    try {
      parsedData = parseRecordJson(block.dataJson, `data del block "${block.id}"`);
    } catch {
      return (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          JSON invalido. Corrige el panel JSON para habilitar editor visual.
        </div>
      );
    }

    if (block.type === 'about') {
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Title</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'title'))}
              onChange={(event) => setBlockDataPath(block.id, 'title', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Tagline</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'tagline'))}
              onChange={(event) => setBlockDataPath(block.id, 'tagline', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Paragraph 1</span>
            <textarea
              value={ensureString(getValueByPath(parsedData, 'paragraphs.0'))}
              onChange={(event) => setBlockDataPath(block.id, 'paragraphs.0', event.target.value)}
              className="h-20 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Paragraph 2</span>
            <textarea
              value={ensureString(getValueByPath(parsedData, 'paragraphs.1'))}
              onChange={(event) => setBlockDataPath(block.id, 'paragraphs.1', event.target.value)}
              className="h-20 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        </div>
      );
    }

    if (block.type === 'cta') {
      return (
        <div className="grid gap-2 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Title</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'title'))}
              onChange={(event) => setBlockDataPath(block.id, 'title', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Subtitle</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'subtitle'))}
              onChange={(event) => setBlockDataPath(block.id, 'subtitle', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">CTA label</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'cta.label'))}
              onChange={(event) => setBlockDataPath(block.id, 'cta.label', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">CTA href</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'cta.href'))}
              onChange={(event) => setBlockDataPath(block.id, 'cta.href', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">CTA variant</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'cta.variant'))}
              onChange={(event) => setBlockDataPath(block.id, 'cta.variant', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Tone</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'tone'))}
              onChange={(event) => setBlockDataPath(block.id, 'tone', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        </div>
      );
    }

    if (block.type === 'hero-collage') {
      return (
        <div className="grid gap-2 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Headline</span>
            <textarea
              value={ensureString(getValueByPath(parsedData, 'headline'))}
              onChange={(event) => setBlockDataPath(block.id, 'headline', event.target.value)}
              className="h-20 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">CTA label</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'cta.label'))}
              onChange={(event) => setBlockDataPath(block.id, 'cta.label', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">CTA href</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'cta.href'))}
              onChange={(event) => setBlockDataPath(block.id, 'cta.href', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Main image src</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'images.main.src'))}
              onChange={(event) => setBlockDataPath(block.id, 'images.main.src', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Main image alt</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'images.main.alt'))}
              onChange={(event) => setBlockDataPath(block.id, 'images.main.alt', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Top image src</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'images.top.src'))}
              onChange={(event) => setBlockDataPath(block.id, 'images.top.src', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-slate-500">Bottom image src</span>
            <input
              value={ensureString(getValueByPath(parsedData, 'images.bottom.src'))}
              onChange={(event) => setBlockDataPath(block.id, 'images.bottom.src', event.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        </div>
      );
    }

    if (block.type === 'categories') {
      return (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1 md:col-span-2">
              <span className="block text-xs text-slate-500">Section title</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'title'))}
                onChange={(event) => setBlockDataPath(block.id, 'title', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Footer href</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'footerLink.href'))}
                onChange={(event) => setBlockDataPath(block.id, 'footerLink.href', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <p className="text-xs font-medium text-slate-600 md:col-span-3">Cards (1-3)</p>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 1 label</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.0.label'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.0.label', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 1 href</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.0.href'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.0.href', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 1 image src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.0.image.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.0.image.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 2 label</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.1.label'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.1.label', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 2 href</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.1.href'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.1.href', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 2 image src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.1.image.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.1.image.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 3 label</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.2.label'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.2.label', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 3 href</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.2.href'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.2.href', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Card 3 image src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'cards.2.image.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'cards.2.image.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
        </div>
      );
    }

    if (block.type === 'triptych-images') {
      return (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">Triptych images</p>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 1 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.0.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.0.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 2 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.1.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.1.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 3 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.2.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.2.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 1 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.0.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.0.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 2 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.1.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.1.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 3 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.2.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.2.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 2 offset</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'images.1.offset'))}
                onChange={(event) => setBlockDataPath(block.id, 'images.1.offset', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Middle offset (desktop px)</span>
              <input
                type="number"
                value={ensureString(getValueByPath(parsedData, 'options.middleImageOffsetPxDesktop'))}
                onChange={(event) =>
                  setBlockDataPath(
                    block.id,
                    'options.middleImageOffsetPxDesktop',
                    Number(event.target.value || 0)
                  )
                }
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
        </div>
      );
    }

    if (block.type === 'gallery-grid') {
      return (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">Imagenes del gallery grid</p>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Title</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'title'))}
                onChange={(event) => setBlockDataPath(block.id, 'title', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Subtitle</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'subtitle'))}
                onChange={(event) => setBlockDataPath(block.id, 'subtitle', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 1 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.0.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.0.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 1 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.0.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.0.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 2 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.1.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.1.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 2 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.1.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.1.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 3 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.2.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.2.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 3 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.2.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.2.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 4 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.3.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.3.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 4 alt</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.3.alt'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.3.alt', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 5 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.4.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.4.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 5 span</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.4.span'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.4.span', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 6 src</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.5.src'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.5.src', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Image 6 span</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.5.span'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.5.span', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
        </div>
      );
    }

    if (block.type === 'promotions') {
      return (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">Promociones (3 items)</p>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 1 title</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.0.title'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.0.title', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 2 title</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.1.title'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.1.title', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 3 title</span>
              <input
                value={ensureString(getValueByPath(parsedData, 'items.2.title'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.2.title', event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 1 description</span>
              <textarea
                value={ensureString(getValueByPath(parsedData, 'items.0.description'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.0.description', event.target.value)}
                className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 2 description</span>
              <textarea
                value={ensureString(getValueByPath(parsedData, 'items.1.description'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.1.description', event.target.value)}
                className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-slate-500">Item 3 description</span>
              <textarea
                value={ensureString(getValueByPath(parsedData, 'items.2.description'))}
                onChange={(event) => setBlockDataPath(block.id, 'items.2.description', event.target.value)}
                className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
          </div>
        </div>
      );
    }

    if (block.type === 'carousel') {
      const slides = Array.isArray(getValueByPath(parsedData, 'slides'))
        ? ((getValueByPath(parsedData, 'slides') as unknown[]).filter(
            (item) => item && typeof item === 'object' && !Array.isArray(item)
          ) as Array<Record<string, unknown>>)
        : [];

      const safeSlides = slides.length > 0 ? slides : [{ src: '', alt: 'Slide 1' }];

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">Slides ({safeSlides.length})</p>
            <button
              type="button"
              onClick={() =>
                mutateBlockData(block.id, (data) => {
                  const currentSlides = Array.isArray(data.slides)
                    ? data.slides
                    : [];
                  currentSlides.push({
                    src: '',
                    alt: `Slide ${currentSlides.length + 1}`,
                  });
                  data.slides = currentSlides;
                })
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Agregar slide
            </button>
          </div>

          <div className="space-y-2">
            {safeSlides.map((slide, index) => (
              <div key={`${block.id}-slide-${index}`} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-5">
                <label className="space-y-1 md:col-span-2">
                  <span className="block text-xs text-slate-500">Slide {index + 1} src</span>
                  <input
                    value={ensureString(slide.src)}
                    onChange={(event) =>
                      setBlockDataPath(block.id, `slides.${index}.src`, event.target.value)
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="block text-xs text-slate-500">Slide {index + 1} alt</span>
                  <input
                    value={ensureString(slide.alt)}
                    onChange={(event) =>
                      setBlockDataPath(block.id, `slides.${index}.alt`, event.target.value)
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      mutateBlockData(block.id, (data) => {
                        const currentSlides = Array.isArray(data.slides)
                          ? [...data.slides]
                          : [];

                        if (currentSlides.length <= 1) {
                          return;
                        }

                        currentSlides.splice(index, 1);
                        data.slides = currentSlides;
                      })
                    }
                    disabled={safeSlides.length <= 1}
                    className="w-full rounded border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <p className="text-xs text-slate-500">
        Este tipo de block aun no tiene formulario visual dedicado. Editalo por JSON.
      </p>
    );
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pages CMS (hibrido)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Editor visual + JSON lateral + drag and drop para ordenar blocks.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <p>
            Estado: <span className="font-semibold text-slate-900">{pageStatus}</span>
          </p>
          <p>
            Version actual: <span className="font-semibold text-slate-900">{currentVersion ?? 'n/a'}</span>
          </p>
          <p className="truncate">Published version id: {publishedVersionId ?? 'n/a'}</p>
        </div>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Contexto y templates</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Schema</span>
            <input
              type="number"
              min={1}
              value={schemaVersion}
              onChange={(event) => setSchemaVersion(Number(event.target.value || 1))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="home"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Locale</span>
            <input
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="es-PE"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Country</span>
            <input
              value={tenantCountryCode}
              onChange={(event) => setTenantCountryCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-brand-500 focus:ring-2"
              placeholder="MX"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">City</span>
            <input
              value={tenantCityCode}
              onChange={(event) => setTenantCityCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-brand-500 focus:ring-2"
              placeholder="GDL"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Template</span>
            <select
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value as TemplateKey)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
                <option key={key} value={key}>
                  {TEMPLATE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button
              type="button"
              onClick={() => {
                void loadPage(slug, locale);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {isFetching ? 'Cargando...' : 'Cargar'}
            </button>
            <button
              type="button"
              onClick={applyTemplate}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Aplicar
            </button>
          </div>
        </div>
      </article>

      <form onSubmit={handleSaveDraft} className="space-y-6">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <label className="space-y-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Nuevo block</span>
                <select
                  value={selectedNewType}
                  onChange={(event) => setSelectedNewType(event.target.value as PageBlockType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                >
                  {BLOCK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleAddBlock}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Agregar block
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlocks((current) =>
                    current.map((block, index) => ({
                      ...block,
                      order: String((index + 1) * 10),
                    }))
                  );
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Normalizar order
              </button>
            </div>

            <label className="w-full md:max-w-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Buscar block</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                placeholder="id, tipo, estado"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
            <p>{visibleBlocks.length} blocks visibles / {blocks.length} totales</p>
            <p>Arrastra una tarjeta y sueltala sobre otra para reordenar.</p>
          </div>

          {loadError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p>{loadError}</p>
            </div>
          ) : null}

          {formError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p>{formError}</p>
            </div>
          ) : null}

          {visibleBlocks.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">No hay blocks para mostrar.</p>
              <p className="mt-1 text-xs text-slate-500">Agrega un block o ajusta el buscador.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                {visibleBlocks.map((block) => {
                  const isUploadingThisBlock = uploadingBlockId === block.id;
                  const isSelected = selectedBlockId === block.id;

                  return (
                    <article
                      key={block.id}
                      draggable
                      onDragStart={() => setDraggingBlockId(block.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropOnBlock(event, block.id)}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={`cursor-grab rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-brand-400 bg-brand-50/30'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <label className="space-y-1 xl:col-span-2">
                          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Id</span>
                          <input
                            value={block.id}
                            onChange={(event) => {
                              updateBlock(block.id, (current) => ({ ...current, id: event.target.value }));
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Tipo</span>
                          <select
                            value={block.type}
                            onChange={(event) => {
                              updateBlock(block.id, (current) => {
                                const nextType = event.target.value as PageBlockType;
                                return {
                                  ...current,
                                  type: nextType,
                                  uploadPath: defaultUploadPathByType(nextType),
                                };
                              });
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                          >
                            {BLOCK_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Order</span>
                          <input
                            type="number"
                            min={0}
                            value={block.order}
                            onChange={(event) => {
                              updateBlock(block.id, (current) => ({ ...current, order: event.target.value }));
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={block.isEnabled}
                            onChange={(event) => {
                              updateBlock(block.id, (current) => ({ ...current, isEnabled: event.target.checked }));
                            }}
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Editor visual</p>
                        <div className="mt-2">{renderVisualFields(block)}</div>
                      </div>

                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Carga de imagen en block</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <label className="space-y-1 xl:col-span-2">
                            <span className="block text-xs text-slate-500">Path JSON destino</span>
                            <input
                              value={block.uploadPath}
                              onChange={(event) => {
                                updateBlock(block.id, (current) => ({ ...current, uploadPath: event.target.value }));
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              placeholder="images.main.src"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-xs text-slate-500">Modo de src</span>
                            <select
                              value={block.uploadMode}
                              onChange={(event) => {
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  uploadMode: event.target.value as SourceMode,
                                }));
                              }}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                            >
                              <option value="key">Guardar S3 key</option>
                              <option value="publicUrl">Guardar URL publica</option>
                              <option value="signedGetUrl">Guardar URL firmada (temporal)</option>
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-xs text-slate-500">Archivo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                updateBlock(block.id, (current) => ({ ...current, uploadFile: file }));
                              }}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </label>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void handleUploadImage(block.id);
                            }}
                            disabled={isUploadingThisBlock}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUploadingThisBlock ? 'Subiendo...' : 'Subir y setear en JSON'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleViewImageFromBlockPath(block.id);
                            }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Ver imagen actual
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlock(block.id)}
                            className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Eliminar block
                          </button>
                          {block.previewUrl ? (
                            <a
                              href={block.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-brand-700 underline"
                            >
                              Ver preview firmado
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="space-y-3">
                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">JSON del block seleccionado</h4>
                  {selectedBlock ? (
                    <>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedBlock.id} ({selectedBlock.type})
                      </p>
                      <textarea
                        value={selectedBlock.dataJson}
                        onChange={(event) => {
                          updateBlock(selectedBlock.id, (current) => ({ ...current, dataJson: event.target.value }));
                        }}
                        className="mt-3 h-60 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2"
                        spellCheck={false}
                      />
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Selecciona un block para editar su JSON.</p>
                  )}
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Theme JSON</h4>
                  <textarea
                    value={themeJson}
                    onChange={(event) => setThemeJson(event.target.value)}
                    className="mt-3 h-44 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2"
                    spellCheck={false}
                  />
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">JSON completo de pagina</h4>
                    <button
                      type="button"
                      onClick={syncPageJsonFromVisual}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Sincronizar
                    </button>
                  </div>
                  <textarea
                    value={pageJsonDraft}
                    onChange={(event) => setPageJsonDraft(event.target.value)}
                    className="mt-3 h-72 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none ring-brand-500 focus:ring-2"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={applyPageJsonToVisual}
                    className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Aplicar JSON al editor visual
                  </button>
                </article>
              </aside>
            </div>
          )}
        </article>

        <footer className="space-y-2">
          <p className="text-xs text-slate-500">
            `Guardar draft` persiste cambios sin publicarlos. `Guardar + publicar` guarda el estado actual y publica esa
            misma version. `Revertir cambios locales` descarta cambios no guardados y recarga desde backend.
          </p>
          <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving || isPublishing}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar draft'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePublish();
            }}
            disabled={isSaving || isPublishing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPublishing ? 'Publicando...' : 'Guardar + publicar'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleRevertLocalChanges();
            }}
            disabled={isFetching || isSaving || isPublishing || !hasLocalChanges}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Revertir cambios no guardados
          </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
