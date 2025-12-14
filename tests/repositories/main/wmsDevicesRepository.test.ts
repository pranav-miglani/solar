/**
 * WMS Devices Repository Tests - Phase 13
 */

import { WmsDevicesRepository } from "@/lib/repositories/main/wmsDevicesRepository"

describe("WmsDevicesRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    delete: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: WmsDevicesRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new WmsDevicesRepository(mockClient)
  })

  describe("findAllWithRelations", () => {
    it("returns devices with site relations", async () => {
      const mockDevices = [
        { id: 1, device_name: "Device A", wms_sites: { id: 1, site_name: "Site" } },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockDevices, error: null })

      const result = await repository.findAllWithRelations()
      
      expect(result).toEqual(mockDevices)
    })
  })

  describe("findBySiteIdWithRelations", () => {
    it("filters devices by site ID", async () => {
      mockClient.order.mockResolvedValueOnce({ data: [], error: null })

      await repository.findBySiteIdWithRelations(5)
      
      expect(mockClient.eq).toHaveBeenCalledWith("wms_site_id", 5)
    })
  })

  describe("findById", () => {
    it("returns device when found", async () => {
      const mockDevice = { id: 1, device_name: "Device A" }
      mockClient.single.mockResolvedValueOnce({ data: mockDevice, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockDevice)
    })
  })

  describe("findByVendorDeviceId", () => {
    it("returns device by site and vendor_device_id", async () => {
      const mockDevice = { id: 1, wms_site_id: 1, vendor_device_id: "VD1" }
      mockClient.single.mockResolvedValueOnce({ data: mockDevice, error: null })

      const result = await repository.findByVendorDeviceId(1, "VD1")
      
      expect(result).toEqual(mockDevice)
    })
  })

  describe("save", () => {
    it("upserts device", async () => {
      const deviceData = { wms_site_id: 1, vendor_device_id: "VD1", device_name: "Device A" }
      const savedDevice = { id: 1, ...deviceData }
      mockClient.single.mockResolvedValueOnce({ data: savedDevice, error: null })

      const result = await repository.save(deviceData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("saveAll", () => {
    it("batch upserts devices", async () => {
      const devicesData = [
        { wms_site_id: 1, vendor_device_id: "VD1", device_name: "Device A" },
        { wms_site_id: 1, vendor_device_id: "VD2", device_name: "Device B" },
      ]
      mockClient.select.mockResolvedValueOnce({ data: devicesData.map((d, i) => ({ id: i + 1, ...d })), error: null })

      const result = await repository.saveAll(devicesData)
      
      expect(result.length).toBe(2)
    })
  })
})

