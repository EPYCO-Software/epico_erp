import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const glassBorder = 'rgba(255,255,255,0.15)';

export const GlassPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{sky.50}',
      100: '{sky.100}',
      200: '{sky.200}',
      300: '{sky.300}',
      400: '{sky.400}',
      500: '{sky.500}',
      600: '{sky.600}',
      700: '{sky.700}',
      800: '{sky.800}',
      900: '{sky.900}',
      950: '{sky.950}',
    },
    colorScheme: {
      dark: {
        content: {
          background: 'rgba(15,23,42,0.35)',
          hoverBackground: 'rgba(255,255,255,0.06)',
          borderColor: glassBorder,
        },
        overlay: {
          popover: { background: 'rgba(15,23,42,0.75)', borderColor: glassBorder },
          modal: { background: 'rgba(15,23,42,0.6)', borderColor: glassBorder },
        },
      },
    },
  },
  components: {
    // La tabla vive dentro de una glass-card: filas transparentes, sin blur propio.
    datatable: {
      colorScheme: {
        dark: {
          header: { background: 'transparent' },
          headerCell: { background: 'transparent' },
          row: { background: 'transparent' },
          footer: { background: 'transparent' },
        },
      },
    },
  },
});
