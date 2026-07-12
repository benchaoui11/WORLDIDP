const menuButton=document.querySelector(".menu");
const navLinks=document.querySelector(".navlinks");
if(menuButton&&navLinks){
  menuButton.addEventListener("click",()=>{
    const open=navLinks.classList.toggle("open");
    menuButton.setAttribute("aria-expanded",String(open));
  });
}
document.querySelectorAll(".navlinks a").forEach(link=>link.addEventListener("click",()=>navLinks?.classList.remove("open")));

const requestForm=document.querySelector("#translation-form");
if(requestForm){
  const selectedService=new URLSearchParams(window.location.search).get("service");
  if(selectedService&&["standard","priority","custom"].includes(selectedService)){
    document.querySelector(`#service-${selectedService}`)?.click();
  }
  requestForm.addEventListener("submit",event=>{
    event.preventDefault();
    const data=new FormData(requestForm);
    const subject=encodeURIComponent("Translation request - FirstIDP");
    const plainBody=
`Hello FirstIDP,

I would like to request a document translation.

Name: ${data.get("name")}
Email: ${data.get("email")}
Service: ${data.get("service")}
Document: ${data.get("document")}
Source language: ${data.get("source")}
Target language: ${data.get("target")}
Needed by: ${data.get("deadline")||"Not specified"}
Preferred delivery: ${data.get("delivery")}
Notes: ${data.get("notes")||"None"}

I understand that FirstIDP provides a private document translation service only.`;
    const body=encodeURIComponent(plainBody);
    const mailtoUrl=`mailto:hello@firstidp.com?subject=${subject}&body=${body}`;

    window.location.href=mailtoUrl;

    const fallbackLink=document.querySelector("#fallback-mailto");
    if(fallbackLink) fallbackLink.href=mailtoUrl;

    const copyBtn=document.querySelector("#copy-request");
    const copyConfirm=document.querySelector("#copy-confirm");
    if(copyBtn){
      copyBtn.onclick=async()=>{
        try{
          await navigator.clipboard.writeText(`To: hello@firstidp.com\nSubject: Translation request - FirstIDP\n\n${plainBody}`);
          if(copyConfirm) copyConfirm.hidden=false;
        }catch(e){
          if(copyConfirm){ copyConfirm.hidden=false; copyConfirm.textContent="Could not copy automatically - please select and copy the text manually."; }
        }
      };
    }

    document.querySelector(".form-status")?.classList.add("show");
  });
}
