import {
    decodeTooltipMainStats,
    formatTooltipMainStats
} from './domain.js?v=v1.4.0-site-quality-20260713-r4';
import { createItemTooltipController } from '../ui/item-tooltip.js?v=v1.4.0-site-quality-20260713-r4';

export function createTooltipController(options) {
    return createItemTooltipController({
        ...options,
        decodeMainStats: decodeTooltipMainStats,
        formatMainStats: formatTooltipMainStats
    });
}
