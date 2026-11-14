import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderUI, screen, seed } from "@/test/render";
import { schoolDate, schoolTimeZone, useSchoolClock } from "./useSchoolClock";
afterEach(()=>vi.useRealTimers());
describe("school-local clock",()=>{
 it("resolves configured timezone labels and dates independently of the computer timezone",()=>{
  expect(schoolTimeZone("GST · UTC+04:00 (Dubai)")).toBe("Asia/Dubai");
  expect(schoolDate(Date.parse("2026-11-11T18:45:00Z"),"IST")).toBe("2026-11-12");
  expect(schoolDate(Date.parse("2026-11-11T18:45:00Z"),"GST")).toBe("2026-11-11");
 });
 it("updates the dashboard day at school midnight without reloading the page",()=>{
  vi.useFakeTimers({toFake:["Date","setInterval","clearInterval"]});vi.setSystemTime(new Date("2026-11-11T18:29:45Z"));
  seed({set_config:[{id:"regional",timezone:"IST"}]});
  function Clock(){const {date}=useSchoolClock();return <p>{date}</p>}
  renderUI(<Clock/>);
  expect(screen.getByText("2026-11-11")).toBeInTheDocument();
  act(()=>vi.advanceTimersByTime(30000));
  expect(screen.getByText("2026-11-12")).toBeInTheDocument();
 });
});
