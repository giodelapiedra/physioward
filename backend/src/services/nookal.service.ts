import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import {
  NookalResponse,
  NookalInvoice,
  NookalAppointment,
  NookalPatient,
  NookalInventoryItem,
  DateRange,
} from '../types';

class NookalService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.NOOKAL_BASE_URL,
      timeout: 30000,
    });
  }

  // Generic paginated fetcher — all Nookal endpoints paginate
  private async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      console.log(`  [nookal] ${endpoint} page ${page}/${totalPages}`);

      const res = await this.client.get<NookalResponse<T[]>>(endpoint, {
        params: { api_key: env.NOOKAL_API_KEY, ...params, page },
      });

      const { details } = res.data;
      if (details.code !== 1) {
        throw new Error(`Nookal error on ${endpoint}: ${details.message}`);
      }

      results.push(...(details.results || []));
      totalPages = details.pages || 1;
      page++;

      if (page <= totalPages) await new Promise(r => setTimeout(r, 150));
    }
    return results;
  }

  private toParams(range: DateRange, locationId?: string) {
    return {
      date_from: range.dateFrom,
      date_to:   range.dateTo,
      ...(locationId && { location_id: locationId }),
    };
  }

  async getInvoices(range: DateRange, locationId?: string): Promise<NookalInvoice[]> {
    return this.fetchAllPages<NookalInvoice>('/getInvoices', this.toParams(range, locationId));
  }

  async getAppointments(range: DateRange, locationId?: string): Promise<NookalAppointment[]> {
    return this.fetchAllPages<NookalAppointment>('/getAppointments', this.toParams(range, locationId));
  }

  async getPatients(range: DateRange, locationId?: string): Promise<NookalPatient[]> {
    return this.fetchAllPages<NookalPatient>('/getPatients', this.toParams(range, locationId));
  }

  async getInventory(range: DateRange, locationId?: string): Promise<NookalInventoryItem[]> {
    return this.fetchAllPages<NookalInventoryItem>('/getInventory', this.toParams(range, locationId));
  }
}

export const nookalService = new NookalService();
