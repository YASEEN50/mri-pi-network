'use client'
// src/components/home/HomeHeroSearch.tsx

import SearchBar from '@/components/common/SearchBar'

export default function HomeHeroSearch() {
  return (
    <div className="max-w-xl mx-auto w-full animate-slide-up">
      <SearchBar variant="hero" />
    </div>
  )
}
