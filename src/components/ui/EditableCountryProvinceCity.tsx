"use client";
import { useState, useEffect, useMemo } from "react";
import EditableField from "./EditableField";

// Editable City Field Component for Pakistan (with autocomplete)
type EditableCityFieldProps = {
  label: string;
  value: unknown;
  fieldKey: string;
  onValueChange: (key: string, value: unknown) => void;
  selectedProvince: string;
  citySearch: string;
  setCitySearch: (value: string) => void;
  showCityDropdown: boolean;
  setShowCityDropdown: (value: boolean) => void;
  filteredCities: string[];
  provinceCities: string[];
  selectedCity: string;
};

function EditableCityField({
  label,
  value,
  fieldKey,
  onValueChange,
  selectedProvince,
  citySearch,
  setCitySearch,
  showCityDropdown,
  setShowCityDropdown,
  filteredCities,
  provinceCities,
  selectedCity,
}: EditableCityFieldProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Initialize citySearch when entering edit mode
  useEffect(() => {
    if (isEditing && citySearch === "") {
      const val = value === null || value === undefined ? "" : String(value);
      setCitySearch(val);
    }
  }, [isEditing, value, setCitySearch]);

  const displayValue = (val: unknown): string => {
    if (val === null || val === undefined || val === "") return "Not provided";
    return String(val);
  };

  if (!isEditing) {
    return (
      <div className="flex flex-col group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        <span className="text-base text-gray-900 break-words">{displayValue(value)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500 mb-1">{label}</span>
      {!selectedProvince ? (
        <div className="mt-1 p-2 rounded border border-gray-300 bg-gray-50 text-sm text-gray-500">
          Please select a province first
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={citySearch}
            onChange={(e) => {
              const val = e.target.value;
              setCitySearch(val);
              setShowCityDropdown(true);
              // Don't update pending changes while typing - only when selecting from dropdown
            }}
            onFocus={() => {
              if (selectedProvince) {
                setShowCityDropdown(true);
              }
            }}
            onBlur={(e) => {
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (relatedTarget && relatedTarget.closest('.city-dropdown')) {
                return;
              }
              setTimeout(() => {
                setShowCityDropdown(false);
                // If the typed value matches a city in the list, use it
                const matchingCity = provinceCities.find(c => c.toLowerCase() === citySearch.toLowerCase().trim());
                if (matchingCity) {
                  onValueChange(fieldKey, matchingCity);
                  setCitySearch(matchingCity);
                } else if (citySearch.trim() === "") {
                  onValueChange(fieldKey, null);
                } else {
                  // If typed value doesn't match, revert to current value
                  const currentCity = selectedCity || "";
                  setCitySearch(currentCity);
                }
              }, 200);
            }}
            placeholder={`Type to search cities in ${selectedProvince}...`}
            disabled={!selectedProvince}
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showCityDropdown && selectedProvince && filteredCities.length > 0 && (
            <div className="city-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
              {filteredCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCitySearch(city);
                    onValueChange(fieldKey, city);
                    setShowCityDropdown(false);
                  }}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
          {showCityDropdown && selectedProvince && filteredCities.length === 0 && citySearch.trim() && (
            <div className="city-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-500">
              No cities found matching &quot;{citySearch}&quot;
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => {
            const finalValue = citySearch.trim() || null;
            onValueChange(fieldKey, finalValue);
            setIsEditing(false);
          }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => {
            setCitySearch(String(value || ""));
            setIsEditing(false);
            onValueChange(fieldKey, undefined);
          }}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Cancel
        </button>
        <span className="text-xs text-gray-500">Save all changes together</span>
      </div>
    </div>
  );
}

const countryOptions = [
  { value: "Pakistan", label: "Pakistan" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Canada", label: "Canada" },
  { value: "Other", label: "Other" },
];

// Pakistan cities organized by province (same as AlumniSqlForm)
const citiesByProvince: Record<string, string[]> = {
  "Punjab": [
    "Lahore", "Rawalpindi", "Faisalabad", "Multan", "Sialkot", "Gujranwala", "Bahawalpur", "Sargodha",
    "Sheikhupura", "Jhang", "Rahim Yar Khan", "Gujrat", "Kasur", "Chiniot", "Hafizabad", "Mianwali",
    "Chakwal", "Attock", "Vehari", "Kamoke", "Burewala", "Sahiwal", "Okara", "Dera Ghazi Khan",
    "Gojra", "Chishtian", "Khanewal", "Jhelum", "Muzaffargarh", "Narowal", "Pakpattan", "Toba Tek Singh",
    "Jaranwala", "Chishtian", "Hasilpur", "Ahmadpur East", "Kot Addu", "Wazirabad", "Daska", "Mandi Bahauddin"
  ],
  "Sindh": [
    "Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Kotri", "Khanpur", "Jacobabad",
    "Shikarpur", "Mirpur Khas", "Tando Allahyar", "Dadu", "Badin", "Thatta", "Khairpur", "Sanghar",
    "Umerkot", "Ghotki", "Naushahro Feroze", "Tando Muhammad Khan", "Matiari", "Tando Allahyar", "Jamshoro"
  ],
  "KPK": [
    "Peshawar", "Mardan", "Mingora", "Kohat", "Nowshera", "Abbottabad", "Mansehra", "Battagram",
    "Haripur", "Dera Ismail Khan", "Bannu", "Swabi", "Charsadda", "Pabbi", "Barikot", "Daggar",
    "Timergara", "Batkhela", "Tank", "Lakki Marwat", "Kulachi", "Tangi", "Takht-i-Bahi", "Mardan",
    "Charsadda", "Nowshera", "Swabi", "Mingora", "Barikot", "Daggar", "Timergara", "Batkhela"
  ],
  "Balochistan": [
    "Quetta", "Turbat", "Gwadar", "Zhob", "Chaman", "Sibi", "Khuzdar", "Kalat", "Mastung",
    "Loralai", "Dera Murad Jamali", "Hub", "Usta Muhammad", "Surab", "Nushki", "Panjgur"
  ],
  "Islamabad": [
    "Islamabad"
  ],
  "GB": [
    "Gilgit", "Skardu", "Hunza", "Chitral", "Ghizer", "Diamer", "Astore", "Ghanche"
  ],
  "AJK": [
    "Muzaffarabad", "Mirpur", "Kotli", "Bhimber", "Rawalakot", "Bagh", "Hattian Bala", "Neelum",
    "Sudhnuti", "Poonch", "Haveli"
  ]
};

const getCitiesByProvince = (province: string): string[] => {
  return citiesByProvince[province] || [];
};

type EditableCountryProvinceCityProps = {
  countryValue: unknown;
  provinceValue: unknown;
  cityValue: unknown;
  onCountryChange: (key: string, value: unknown) => void;
  onProvinceChange: (key: string, value: unknown) => void;
  onCityChange: (key: string, value: unknown) => void;
};

export default function EditableCountryProvinceCity({
  countryValue,
  provinceValue,
  cityValue,
  onCountryChange,
  onProvinceChange,
  onCityChange,
}: EditableCountryProvinceCityProps) {
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const selectedCountry = String(countryValue || "");
  const selectedProvince = String(provinceValue || "");
  const selectedCity = String(cityValue || "");

  // Province options based on country
  const provinceOptions = useMemo(() => {
    if (selectedCountry === "Pakistan") {
      return [
        { value: "Punjab", label: "Punjab" },
        { value: "Sindh", label: "Sindh" },
        { value: "KPK", label: "KPK" },
        { value: "Balochistan", label: "Balochistan" },
        { value: "Islamabad", label: "Islamabad Capital Territory" },
        { value: "GB", label: "Gilgit-Baltistan" },
        { value: "AJK", label: "Azad Kashmir" },
      ];
    } else if (selectedCountry && selectedCountry !== "" && selectedCountry !== "Select") {
      return [{ value: "Other", label: "Other" }];
    }
    return [];
  }, [selectedCountry]);

  // Get cities for selected province
  const provinceCities = useMemo(() => {
    if (selectedCountry === "Pakistan" && selectedProvince) {
      return getCitiesByProvince(selectedProvince);
    }
    return [];
  }, [selectedCountry, selectedProvince]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (selectedCountry === "Pakistan" && !selectedProvince) {
      return [];
    }
    if (selectedCountry === "Pakistan" && selectedProvince && provinceCities.length > 0) {
      if (!citySearch.trim()) {
        return provinceCities; // Show all cities if no search text
      }
      const searchLower = citySearch.toLowerCase();
      return provinceCities.filter(city => 
        city.toLowerCase().includes(searchLower)
      );
    }
    return [];
  }, [citySearch, selectedCountry, selectedProvince, provinceCities]);

  // Initialize citySearch from value when component mounts or value changes (but not during active typing)
  useEffect(() => {
    if (selectedCountry === "Pakistan" && selectedCity) {
      // Only sync if citySearch is empty or if the selectedCity doesn't match current citySearch
      // This prevents overwriting user input while typing
      if (citySearch === "" || citySearch !== selectedCity) {
        setCitySearch(selectedCity);
      }
    } else if (!selectedCity) {
      setCitySearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, selectedCountry]);

  // Reset city when country or province changes
  useEffect(() => {
    if (selectedCountry && selectedCountry !== "Pakistan") {
      onCityChange("city", "");
      setCitySearch("");
    }
  }, [selectedCountry, onCityChange]);

  useEffect(() => {
    if (selectedCountry === "Pakistan" && selectedProvince) {
      const validCities = getCitiesByProvince(selectedProvince);
      if (selectedCity && !validCities.includes(selectedCity)) {
        onCityChange("city", "");
        setCitySearch("");
      }
    } else if (selectedCountry === "Pakistan" && !selectedProvince) {
      onCityChange("city", "");
      setCitySearch("");
    }
  }, [selectedProvince, selectedCountry, selectedCity, onCityChange]);

  return (
    <>
      <EditableField
        label="Country"
        value={countryValue}
        fieldKey="country"
        onValueChange={onCountryChange}
        type="select"
        options={countryOptions}
        batchMode={true}
      />
      {selectedCountry === "Pakistan" ? (
        <EditableField
          label="Province"
          value={provinceValue}
          fieldKey="province"
          onValueChange={onProvinceChange}
          type="select"
          options={provinceOptions}
          batchMode={true}
        />
      ) : (
        <EditableField
          label="Province"
          value={provinceValue}
          fieldKey="province"
          onValueChange={onProvinceChange}
          type="text"
          batchMode={true}
        />
      )}
      {selectedCountry === "Pakistan" ? (
        <EditableCityField
          provinceCities={provinceCities}
          selectedCity={selectedCity}
          label="City"
          value={cityValue}
          fieldKey="city"
          onValueChange={onCityChange}
          selectedProvince={selectedProvince}
          citySearch={citySearch}
          setCitySearch={setCitySearch}
          showCityDropdown={showCityDropdown}
          setShowCityDropdown={setShowCityDropdown}
          filteredCities={filteredCities}
        />
      ) : (
        <EditableField
          label="City"
          value={cityValue}
          fieldKey="city"
          onValueChange={onCityChange}
          type="text"
          batchMode={true}
        />
      )}
    </>
  );
}

