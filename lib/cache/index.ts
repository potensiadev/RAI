/**
 * Cache module exports
 * 검색 캐싱 관련 유틸리티
 */

export {
  generateCacheKey,
  getCacheStrategy,
  getSearchFromCache,
  setSearchCache,
  getSearchWithSWR,
  invalidateUserSearchCache,
  isCacheEnabled,
} from './search-cache';
