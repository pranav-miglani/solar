/**
 * WMS Sites Repository Tests - Phase 12
 */

import { WmsSitesRepository } from "@/lib/repositories/main/wmsSitesRepository"

describe("WmsSitesRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    delete: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: WmsSitesRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new WmsSitesRepository(mockClient)
  })

  describe("findAllWithRelations", () => {
    it("returns sites with relations and device count", async () => {
      const mockSites = [
        { id: 1, site_name: "Site A", wms_vendors: { id: 1, name: "Vendor" }, organizations: { id: 1, name: "Org" }, wms_devices: [1, 2] },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockSites, error: null })

      const result = await repository.findAllWithRelations()
      
      expect(result[0].device_count).toBe(2)
      expect(result[0].wms_devices).toBeUndefined()
    })
  })

  describe("findById", () => {
    it("returns site when found", async () => {
      const mockSite = { id: 1, site_name: "Site A" }
      mockClient.single.mockResolvedValueOnce({ data: mockSite, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockSite)
    })
  })

  describe("findByVendorSiteId", () => {
    it("returns site by vendor and vendor_site_id", async () => {
      const mockSite = { id: 1, wms_vendor_id: 1, vendor_site_id: "VS1" }
      mockClient.single.mockResolvedValueOnce({ data: mockSite, error: null })

      const result = await repository.findByVendorSiteId(1, "VS1")
      
      expect(result).toEqual(mockSite)
      expect(mockClient.eq).toHaveBeenCalledWith("wms_vendor_id", 1)
      expect(mockClient.eq).toHaveBeenCalledWith("vendor_site_id", "VS1")
    })
  })

  describe("save", () => {
    it("upserts site", async () => {
      const siteData = { wms_vendor_id: 1, vendor_site_id: "VS1", site_name: "Site A", org_id: 1 }
      const savedSite = { id: 1, ...siteData }
      mockClient.single.mockResolvedValueOnce({ data: savedSite, error: null })

      const result = await repository.save(siteData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("saveAll", () => {
    it("batch upserts sites", async () => {
      const sitesData = [
        { wms_vendor_id: 1, vendor_site_id: "VS1", site_name: "Site A", org_id: 1 },
        { wms_vendor_id: 1, vendor_site_id: "VS2", site_name: "Site B", org_id: 1 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: sitesData.map((s, i) => ({ id: i + 1, ...s })), error: null })

      const result = await repository.saveAll(sitesData)
      
      expect(result.length).toBe(2)
    })
  })

  describe("deleteById", () => {
    it("deletes site", async () => {
      mockClient.eq.mockResolvedValueOnce({ error: null })

      await repository.deleteById(1)
      
      expect(mockClient.delete).toHaveBeenCalled()
    })
  })
})

