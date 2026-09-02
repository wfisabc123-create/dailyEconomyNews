# Vercel 배포 안내

이 폴더를 Vercel 프로젝트의 루트로 배포하세요. `economy-dashboard.html`은 화면을 제공하고, `api/`의 함수들이 시세와 뉴스를 서버 측에서 가져옵니다. 따라서 로컬의 `server.js`와 `start-dashboard.cmd`는 Vercel에서 사용하지 않습니다.

## GitHub 연동 배포

1. 이 폴더의 내용으로 GitHub 저장소를 만듭니다.
2. Vercel에서 **New Project**를 선택하고 해당 저장소를 Import합니다.
3. **Root Directory**를 이 폴더로 지정합니다. 저장소 루트 자체가 이 폴더라면 변경할 필요가 없습니다.
4. Framework Preset은 **Other**로 둡니다. Build Command와 Output Directory는 비워둡니다.
5. Deploy를 선택합니다.

배포가 끝나면 생성된 `https://<project>.vercel.app` 주소로 어느 PC에서나 접속할 수 있습니다. `main` 브랜치에 push할 때마다 프로덕션 버전이 자동 갱신됩니다.

## CLI 배포

PowerShell에서 이 폴더를 연 뒤 다음을 실행합니다.

```powershell
npm i -g vercel
vercel --prod
```

첫 실행 시 Vercel 로그인과 프로젝트 생성 질문에 답하면 됩니다.

## 유의 사항

- 외부 공개 주소이므로 API 키나 개인 정보를 코드에 넣지 마세요.
- 현재 시세·뉴스·번역은 공개 데이터 경로를 사용합니다. 상업 운영 시에는 정식 데이터 API와 호출 제한을 권장합니다.
