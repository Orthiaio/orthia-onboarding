import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

function generateSlug(): string {
  return Math.random().toString(36).substring(2, 10);
}

const RESEARCH_PROMPT = (clinicName: string) => `You are researching a dental/orthodontic practice called "${clinicName}" to pre-fill an onboarding form.

Search thoroughly using their website, Google Business Profile, social media pages, review sites (Yelp, Healthgrades, Zocdoc), and any other public sources. Extract as much of the following as you can find:

**Practice Details:**
- officialName: The full official practice name
- dbaName: DBA or "doing business as" name if different
- practiceType: e.g., "Orthodontics", "General Dentistry", "Pediatric Dentistry", "Multi-specialty", "Oral Surgery"
- website: The practice website URL
- officePhone: Main phone number
- officeEmail: Main email address (often on contact page or Google Business)
- address: Full street address
- timezone: Time zone based on their location (e.g., "Eastern (ET)", "Central (CT)", "Mountain (MT)", "Pacific (PT)")

**Locations:**
- locations: Number of locations (e.g., "1", "3", "5+")
- additionalLocations: If multiple locations, list additional addresses

**People:**
- doctorNames: Names of doctors/orthodontists at the practice
- officeManager: Office manager name if listed

**Hours:**
- clinicHours: Object with days as keys, each having open/close times and closed boolean. e.g., {"Monday": {"open": "08:00", "close": "17:00", "closed": false}, "Saturday": {"open": "", "close": "", "closed": true}}

**Services & Policies (from their website):**
- consultationPrice: Whether consultations are free or the price
- paymentMethods: Payment methods accepted
- insuranceNotAccepted: Insurance plans they do NOT accept (if listed)
- financingOptions: Financing options (CareCredit, payment plans, etc.)
- pmsName: Practice Management Software if mentioned anywhere (Dolphin, Dentrix, Cloud 9, Ortho2, Open Dental, Eaglesoft, OrthoTrac, Curve Dental)
- cancellationPolicy: Their cancellation policy if published
- missedApptPolicy: Missed appointment policy if published

Respond with ONLY a valid JSON object, no other text. Use null for any field you cannot find. Example format:
{
  "officialName": "...",
  "dbaName": null,
  "practiceType": "...",
  "website": "...",
  "officePhone": "...",
  "officeEmail": null,
  "address": "...",
  "timezone": "...",
  "locations": "1",
  "additionalLocations": null,
  "doctorNames": "...",
  "officeManager": null,
  "clinicHours": null,
  "consultationPrice": null,
  "paymentMethods": null,
  "insuranceNotAccepted": null,
  "financingOptions": null,
  "pmsName": null,
  "cancellationPolicy": null,
  "missedApptPolicy": null
}`;

export async function POST(req: NextRequest) {
  // Check admin auth
  const authCookie = req.cookies.get("admin_auth");
  if (authCookie?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clinicName } = await req.json();
  if (!clinicName || typeof clinicName !== "string") {
    return NextResponse.json(
      { error: "clinicName is required" },
      { status: 400 }
    );
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4o",
      tools: [{ type: "web_search_preview" }],
      input: RESEARCH_PROMPT(clinicName),
    });

    // Extract text from response
    let resultText = "";
    for (const item of response.output) {
      if (item.type === "message") {
        for (const block of item.content) {
          if (block.type === "output_text") {
            resultText += block.text;
          }
        }
      }
    }

    // Parse JSON from response — use a greedy match for nested objects
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    let research: Record<string, unknown> = {};

    if (jsonMatch) {
      try {
        research = JSON.parse(jsonMatch[0]);
      } catch {
        // Keep empty if parsing fails
      }
    }

    const slug = generateSlug();

    // Build form_data from research
    const formData: Record<string, unknown> = {};
    if (research.address) formData.address = research.address;
    if (research.timezone) formData.timezone = research.timezone;
    if (research.additionalLocations) formData.additionalLocations = research.additionalLocations;
    if (research.locations && Number(research.locations) > 1) formData.multiLocation = true;
    if (research.doctorNames) formData.doctorNames = research.doctorNames;
    if (research.clinicHours) formData.clinicHours = research.clinicHours;
    if (research.consultationPrice) formData.consultationPrice = research.consultationPrice;
    if (research.paymentMethods) formData.paymentMethods = research.paymentMethods;
    if (research.insuranceNotAccepted) formData.insuranceNotAccepted = research.insuranceNotAccepted;
    if (research.financingOptions) formData.financingOptions = research.financingOptions;
    if (research.cancellationPolicy) formData.cancellationPolicy = research.cancellationPolicy;
    if (research.missedApptPolicy) formData.missedApptPolicy = research.missedApptPolicy;
    if (research.officeManager) formData.pointOfContact = research.officeManager;

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        practice_name: (research.officialName as string) || clinicName,
        practice_type: (research.practiceType as string) || null,
        locations: (research.locations as string) || null,
        pms: (research.pmsName as string) || null,
        website: (research.website as string) || null,
        office_phone: (research.officePhone as string) || null,
        office_email: (research.officeEmail as string) || null,
        dba_name: (research.dbaName as string) || null,
        slug,
        status: "pending",
        contact_name: null,
        email: null,
        phone: null,
        notes: null,
        contact_role: null,
        form_data: formData,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      submission: data,
      link: `/onboard/${slug}`,
    });
  } catch (err) {
    console.error("Research error:", err);
    return NextResponse.json(
      { error: "Failed to research clinic" },
      { status: 500 }
    );
  }
}
