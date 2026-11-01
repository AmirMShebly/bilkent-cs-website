import type { APIRoute } from 'astro';
import { feedResponse } from '@/lib/feeds';

export const GET: APIRoute = ({ site }) => feedResponse(site, 'en');
