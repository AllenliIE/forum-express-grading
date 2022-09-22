const request = require('supertest')
const chai = require('chai')
const sinon = require('sinon')
const should = chai.should()

const app = require('../app')
const { createModelMock, createControllerProxy, mockRequest, mockResponse, mockNext } = require('../helpers/unit-test-helper');

describe('# R01', () => {
  describe('登入測試: POST /signin', function(){
    // 以下測試會發出請求，測試資料庫內是否有作業指定的使用者資料
    // 測試資料的來源是真實的資料庫
    it('#1 密碼錯誤', function(done){
      request(app)
        // 對 POST /signin 發出請求，參數是錯誤的密碼
        .post('/signin')
        .type('urlencoded')
        .send('email=root@example.com&password=123')
        // 期待登入驗證回應失敗，重新導向 /signin
        .expect('Location', '/signin')
        .expect(302, done)
    })

    it('#2 帳號錯誤', function(done){
      request(app)
        // 對 POST /signin 發出請求，參數是錯誤的帳號
        .post('/signin')
        .type('urlencoded')
        .send('email=tu&password=12345678')
        // 期待登入驗證回應失敗，重新導向 /signin
        .expect('Location', '/signin')
        .expect(302, done)
    })

    it('#3 成功登入', function(done){
      request(app)
        // 對 POST /signin 發出請求，參數是作業指定的使用者帳號密碼
        .post('/signin')
        .type('urlencoded')
        .send('email=root@example.com&password=12345678')
        // 期待登入驗證成功，重新導向 /restaurants 
        .expect('Location', '/restaurants')
        .expect(302, done)
    })
  });

  describe('# 使用者權限管理', function () {
    // 前置準備
    before(() => {
      // 製作假資料
      // 本 context 會用這筆資料進行測試
      this.UserMock = createModelMock('User', [{
        id: 1,
        email: 'root@example.com',
        name: 'admin',
        isAdmin: false,
      }])

      // 修改 adminController 中的資料庫連線設定，由連向真實的資料庫 -> 改為連向模擬的 User table
      this.adminController = createControllerProxy('../controllers/admin-controller', { User: this.UserMock })
    })
    
    // 開始測試
    context('# [顯示使用者清單]', () => {
      it(' GET /admin/users ', async () => {
        // 模擬 request & response & next
        const req = mockRequest() // 對 GET /admin/users 發出請求
        const res = mockResponse()
        const next = mockNext

        // 測試作業指定的 adminController.getUsers 函式
        await this.adminController.getUsers(req, res, next)

        // getUser 正確執行的話，應呼叫 res.render
        // res.render 的第 2 個參數應是 users
        // 根據測試資料，users 中的第 1 筆資料，name 屬性值應該要是 'admin'
        res.render.getCall(0).args[1].users[0].name.should.equal('admin')
      })
    })

    context('# [修改使用者權限] for root', () => {
      before(() => {
      // 製作假資料
      // 本 context 會用這筆資料進行測試
        this.UserMock = createModelMock(
          'User', 
          [{
            id: 1,
            email: 'root@example.com',
            name: 'admin',
            isAdmin: true, // 是管理者
          }]
        )
        
        // 將 adminController 中的 User db 取代成 User mock db
        this.adminController = createControllerProxy('../controllers/admin-controller', { User: this.UserMock })
      })

      it(' PATCH /admin/users/:id ', async () => {
        // 模擬 request & response & next
        const req = mockRequest({ params: { id: 1 } }) // 帶入 params.id = 1，對 PATCH /admin/users/1 發出請求
        const res = mockResponse()
        const next = mockNext

       // 測試作業指定的 adminController.patchUser 函式
        await this.adminController.patchUser(req, res, next)

        // patchUser 正確執行的話，應呼叫 req.flash
        // req.flash 的參數應該要與下列字串一致
        req.flash.calledWith('error_messages','禁止變更 root 權限').should.be.true

        // patchUser 執行完畢，應呼叫 res.redirect 並重新導向上一頁 
        res.redirect.calledWith('back').should.be.true
      })
    })

    context('# [修改使用者權限] for user (user -> admin)', () => {
      before(() => {
        // 製作假資料
        // 本 context 會用這筆資料進行測試
        this.UserMock = createModelMock(
          'User',
          [{
            id: 1,
            email: 'user@example.com',
            name: 'user',
            isAdmin: false, // 非管理者
          }]
        )
        // 將 adminController 中的 User db 取代成 User mock db
        this.adminController = createControllerProxy('../controllers/admin-controller', { User: this.UserMock })
      })

      it(' PATCH /admin/users/:id ', async () => {
        // 模擬 request & response & next
        const req = mockRequest({ params: { id: 1 } }) // 帶入 params.id = 1，對 PATCH /admin/users/1 發出請求
        const res = mockResponse()
        const next = mockNext

        // 測試作業指定的 adminController.patchUser 函式
        await this.adminController.patchUser(req, res, next)

        // patchUser 正確執行的話，應呼叫 req.flash 
        // req.flash 的參數應與下列字串一致
        req.flash.calledWith('success_messages','使用者權限變更成功').should.be.true
        // patchUser 執行完畢，應呼叫 res.redirect 並重新導向 /admin/users
        res.redirect.calledWith('/admin/users').should.be.true

        // patchUser 執行完畢後，假資料中 id:1 使用者的應該要是 isAdmin：true
        // 將假資料撈出，比對確認有成功修改到
        const user = await this.UserMock.findOne({ where: { id: 1 } })
        user.isAdmin.should.equal(true)
      })
    })

    context('# [修改使用者權限] for user (admin -> user)', () => {
      before(() => {
        // 製作假資料
        // 本 context 會用這筆資料進行測試
        this.UserMock = createModelMock(
          'User',
          [{
            id: 2,
            email: 'user2@example.com',
            name: 'user2',
            isAdmin: true // 是管理者
          }]
        )
        // 將 adminController 中的 User db 取代成 User mock db
        this.adminController = createControllerProxy('../controllers/admin-controller', { User: this.UserMock })
      })

      it(' PATCH /admin/users/:id ', async () => {
        // 模擬 request & response & next
        const req = mockRequest({ params: { id: 2 } }) // 帶入 params.id = 2，對 PATCH /admin/users/2 發出請求
        const res = mockResponse()
        const next = mockNext

        // 測試作業指定的 adminController.patchUser 函式
        await this.adminController.patchUser(req, res, next)

        // patchUser 正確執行的話，應呼叫 req.flash 
        // req.flash 的參數應與下列字串一致
        req.flash.calledWith('success_messages','使用者權限變更成功').should.be.true
        // patchUser 執行完畢，應呼叫 res.redirect 並重新導向 /admin/users
        res.redirect.calledWith('/admin/users').should.be.true

        // patchUser 執行完畢後，假資料中 id:2 使用者的應該要是 isAdmin：false
        // 將假資料撈出，比對確認有成功修改到
        const user = await this.UserMock.findOne({ where: { id: 2 } })
        user.isAdmin.should.equal(false)
      })
    })
  })
})
