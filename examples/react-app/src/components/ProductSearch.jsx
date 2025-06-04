import React, { useState } from 'react';

/**
 * Product search and filtering component
 */
const ProductSearch = ({ onSearch, categories }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortBy, setSortBy] = useState('relevance');

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const handlePriceMinChange = (e) => {
    setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 });
  };

  const handlePriceMaxChange = (e) => {
    setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 1000 });
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Call the search function with all parameters
    onSearch({
      searchTerm,
      category: selectedCategory,
      priceRange,
      sortBy
    });
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setPriceRange({ min: 0, max: 1000 });
    setSortBy('relevance');
  };

  return (
    <div className="product-search">
      <h2>Find Products</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="search-input">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search for products..."
          />
          <button type="submit">Search</button>
        </div>
        
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                min="0"
                value={priceRange.min}
                onChange={handlePriceMinChange}
                placeholder="Min"
              />
              <span>to</span>
              <input
                type="number"
                min="0"
                value={priceRange.max}
                onChange={handlePriceMaxChange}
                placeholder="Max"
              />
            </div>
          </div>
          
          <div className="filter-group">
            <label htmlFor="sort">Sort By</label>
            <select
              id="sort"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="relevance">Relevance</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest First</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
        
        <div className="filter-actions">
          <button type="submit" className="apply-filters">Apply Filters</button>
          <button type="button" onClick={handleReset} className="reset-filters">Reset</button>
        </div>
      </form>
    </div>
  );
};

export default ProductSearch; 