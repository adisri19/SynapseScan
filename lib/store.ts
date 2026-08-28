import { create } from 'zustand';
import { DashboardData, ReviewFilters } from './types';
import { BRAND } from './constants';

interface AppStore {
  currentRunId: string | null;
  setCurrentRunId: (id: string | null) => void;

  tenantName: string;
  setTenantName: (name: string) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  dashboardData: DashboardData | null;
  setDashboardData: (data: DashboardData | null) => void;

  reviewFilters: ReviewFilters;
  setReviewFilters: (filters: Partial<ReviewFilters>) => void;
}

const defaultFilters: ReviewFilters = {
  status: 'All Statuses',
  severity: 'All Levels',
  module: 'All Modules',
  startDate: '',
  endDate: ''
};

export const useAppStore = create<AppStore>((set) => ({
  currentRunId: null,
  setCurrentRunId: (id) => set({ currentRunId: id }),

  tenantName: BRAND.tenantName,
  setTenantName: (name) => set({ tenantName: name }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  dashboardData: null,
  setDashboardData: (data) => set({ dashboardData: data }),

  reviewFilters: defaultFilters,
  setReviewFilters: (filters) => set((state) => ({
    reviewFilters: { ...state.reviewFilters, ...filters }
  }))
}));
