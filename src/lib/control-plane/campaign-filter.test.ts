import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CAMPAIGN_FILTER,
  countByStatus,
  filterCampaigns,
  filterHref,
  parseCampaignFilter,
} from "./campaign-filter";

const rows = [
  { id: 1, status: "active" as const },
  { id: 2, status: "paused" as const },
  { id: 3, status: "active" as const },
  { id: 4, status: "pending" as const },
];

describe("campaign filter", () => {
  it("mặc định là 'đang chạy'", () => {
    assert.equal(DEFAULT_CAMPAIGN_FILTER, "active");
    assert.equal(parseCampaignFilter(undefined), "active");
    assert.equal(parseCampaignFilter(""), "active");
  });

  it("giá trị lạ trong URL → mặc định, không lỗi", () => {
    for (const v of ["ACTIVE", "deleted", "<script>", "active,paused", "all ", "__proto__"]) {
      assert.equal(parseCampaignFilter(v), "active", v);
    }
    for (const v of ["active", "paused", "pending", "all"]) assert.equal(parseCampaignFilter(v), v);
  });

  it("mặc định ẩn chiến dịch tạm dừng và chờ duyệt", () => {
    const shown = filterCampaigns(rows, "active");
    assert.deepEqual(shown.map((r) => r.id), [1, 3]);
    assert.ok(!shown.some((r) => r.status === "paused"));
  });

  it("từng bộ lọc chỉ giữ đúng trạng thái; 'tất cả' giữ hết và giữ thứ tự", () => {
    assert.deepEqual(filterCampaigns(rows, "paused").map((r) => r.id), [2]);
    assert.deepEqual(filterCampaigns(rows, "pending").map((r) => r.id), [4]);
    assert.deepEqual(filterCampaigns(rows, "all").map((r) => r.id), [1, 2, 3, 4]);
  });

  it("đếm theo trạng thái (đếm TRƯỚC khi lọc nên các tab luôn hiện đúng số)", () => {
    assert.deepEqual(countByStatus(rows), { active: 2, paused: 1, pending: 1, all: 4 });
    assert.deepEqual(countByStatus([]), { active: 0, paused: 0, pending: 0, all: 0 });
  });

  it("link bộ lọc: mặc định không có param", () => {
    assert.equal(filterHref("active"), "/admin/campaigns");
    assert.equal(filterHref("paused"), "/admin/campaigns?status=paused");
    assert.equal(filterHref("all"), "/admin/campaigns?status=all");
  });
});
